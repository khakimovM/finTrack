import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, newUser } from './helpers/api-client';
import { callbackUpdate, FakeTgUser, textUpdate, voiceUpdate } from './helpers/fake-telegram';
import { GeminiClient } from '../src/modules/assistant/providers/gemini.client';
import { GroqSpeechToText } from '../src/modules/assistant/providers/groq-stt.client';
import { ClaudeClient } from '../src/modules/assistant/providers/claude.client';
import { AssistantProviderError } from '../src/modules/assistant/assistant.types';
import { Extraction } from '../src/modules/assistant/extraction.schema';
import { TelegramFilesService } from '../src/infra/telegram/telegram-files.service';

type Entry = Extraction['entries'][number];

const entry = (over: Partial<Entry>): Entry => ({
  type: 'EXPENSE',
  amount: '20000',
  note: 'taksi',
  category: '',
  account: '',
  daysAgo: 0,
  ...over,
});

describe('Voice and free-text assistant in the bot (e2e)', () => {
  let ctx: TestApp;
  const gemini = { enabled: true, extractFromAudio: jest.fn(), extractFromText: jest.fn() };
  const files = { download: jest.fn() };

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder
        .overrideProvider(GeminiClient)
        .useValue(gemini)
        .overrideProvider(GroqSpeechToText)
        .useValue({ enabled: false, transcribe: jest.fn() })
        .overrideProvider(ClaudeClient)
        .useValue({ enabled: false, extractFromText: jest.fn() })
        .overrideProvider(TelegramFilesService)
        .useValue(files),
    );
  });

  beforeEach(() => {
    gemini.extractFromAudio.mockReset();
    gemini.extractFromText.mockReset();
    files.download.mockReset().mockResolvedValue(Buffer.from('OggS fake voice'));
  });

  afterAll(async () => {
    await ctx.close();
  });

  const tg = (client: ApiClient): FakeTgUser => {
    if (!client.telegramUser) throw new Error('client has no Telegram identity');
    return client.telegramUser;
  };
  const outputs = (client: ApiClient) => ctx.telegram.outputs(tg(client).id);
  const saveButtons = (client: ApiClient) =>
    outputs(client).flatMap((o) => o.buttons).filter((b) => /^d:[\w-]{8}:save$/.test(b));

  async function transactions(client: ApiClient) {
    return (await client.get('/transactions?limit=50')).body.data as Array<{
      type: string;
      amount: string;
      note: string | null;
      category: { name: string } | null;
    }>;
  }

  it('turns one voice note into several drafts and saves only what the user confirms', async () => {
    const user = await newUser(ctx);
    gemini.extractFromAudio.mockResolvedValue({
      transcript: 'taksiga yigirma ming, dorixonaga ellik ming',
      entries: [
        entry({ amount: '20000', note: 'taksi', category: 'Transport' }),
        // The model spelled the apostrophe differently from the stored category name.
        entry({ amount: '50000', note: 'dorixona', category: "Sog'liq" }),
      ],
      debtMentioned: false,
    });

    await ctx.deliver(voiceUpdate(tg(user), 7));

    const [audio, mimeType, context] = gemini.extractFromAudio.mock.calls[0];
    expect(Buffer.isBuffer(audio)).toBe(true);
    expect(mimeType).toBe('audio/ogg');
    expect(context.expenseCategories).toEqual(expect.arrayContaining(['Transport', 'Sog‘liq']));
    expect(JSON.stringify(context)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // names only, no ids

    const texts = outputs(user).map((o) => o.text);
    expect(texts.some((t) => t.includes('Eshitdim: «taksiga yigirma ming, dorixonaga ellik ming»'))).toBe(true);
    expect(texts.some((t) => t.includes('2 ta yozuv topildi'))).toBe(true);
    expect(texts.filter((t) => t.includes('Ovozdan tanildi'))).toHaveLength(2);
    expect(await transactions(user)).toHaveLength(0);

    for (const save of saveButtons(user)) await ctx.deliver(callbackUpdate(tg(user), save));

    const saved = await transactions(user);
    expect(saved.map((t) => [t.amount, t.category?.name]).sort()).toEqual([
      ['2000000', 'Transport'],
      ['5000000', 'Sog‘liq'],
    ]);
  });

  it('rejects long voice notes before downloading them', async () => {
    const user = await newUser(ctx);
    await ctx.deliver(voiceUpdate(tg(user), 120));

    expect(files.download).not.toHaveBeenCalled();
    expect(ctx.telegram.last(tg(user).id).text).toContain('60 soniyadan oshmasin');
  });

  it('explains that lending money is not an expense', async () => {
    const user = await newUser(ctx);
    gemini.extractFromAudio.mockResolvedValue({ transcript: 'Akmalga 100 ming qarz berdim', entries: [], debtMentioned: true });

    await ctx.deliver(voiceUpdate(tg(user), 4));

    expect(ctx.telegram.last(tg(user).id).text).toContain('Qarz berish yoki olish xarajat emas');
    expect(saveButtons(user)).toHaveLength(0);
  });

  it('asks for text when no provider can process the voice note', async () => {
    const user = await newUser(ctx);
    gemini.extractFromAudio.mockRejectedValue(new AssistantProviderError('gemini', 'unavailable'));

    await ctx.deliver(voiceUpdate(tg(user), 4));

    expect(ctx.telegram.last(tg(user).id).text).toContain('Hozir xabarni tahlil qilib bo‘lmadi');
  });

  it('sends number words the parser cannot read to the AI, but not small talk', async () => {
    const user = await newUser(ctx);
    gemini.extractFromText.mockResolvedValue({
      transcript: 'tushlikka qirq besh ming',
      entries: [entry({ amount: '45000', note: 'tushlik', category: 'Oziq-ovqat' })],
      debtMentioned: false,
    });

    await ctx.deliver(textUpdate(tg(user), 'salom'));
    expect(gemini.extractFromText).not.toHaveBeenCalled();
    expect(ctx.telegram.last(tg(user).id).text).toContain('Tushunmadim');

    await ctx.deliver(textUpdate(tg(user), 'tushlikka qirq besh ming'));
    expect(gemini.extractFromText).toHaveBeenCalledWith('tushlikka qirq besh ming', expect.any(Object));
    const card = ctx.telegram.last(tg(user).id);
    expect(card.text).toContain('45 000 so‘m');
    expect(card.text).toContain('Oziq-ovqat');
  });

  it('ignores voice notes from people who are not registered', async () => {
    const stranger = ctx.telegram.newUser('Stranger');
    await ctx.deliver(voiceUpdate(stranger, 3));

    expect(files.download).not.toHaveBeenCalled();
    expect(ctx.telegram.last(stranger.id).text).toContain('ro‘yxatdan o‘ting');
  });
});
