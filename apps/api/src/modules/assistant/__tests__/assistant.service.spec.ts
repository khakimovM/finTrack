import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { AssistantService, looksLikeEntry } from '../assistant.service';
import { AssistantProviderError } from '../assistant.types';
import { Extraction } from '../extraction.schema';
import { GeminiClient } from '../providers/gemini.client';
import { GroqSpeechToText } from '../providers/groq-stt.client';
import { ClaudeClient } from '../providers/claude.client';
import { CategoriesRepository } from '../../categories/categories.repository';
import { AccountsRepository } from '../../accounts/accounts.repository';
import { RedisService } from '../../../infra/redis/redis.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { clockStub } from '../../../infra/clock/__tests__/clock.stub';

const user = { id: 'user-1', timezone: 'Asia/Tashkent' } as User;
const voice = { data: Buffer.from('OggS'), mimeType: 'audio/ogg', fileName: 'voice.ogg' };

const extraction = (amount = '20000'): Extraction => ({
  transcript: 'taksiga yigirma ming',
  entries: [{ type: 'EXPENSE', amount, note: 'taksi', category: 'Transport', account: '', daysAgo: 0 }],
  debtMentioned: false,
});

/** Minimal in-memory Redis: enough for counters and cooldown keys. */
function memoryRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK' as const;
    }),
    incrWithTtl: jest.fn(async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    }),
  };
}

function setup(opts: { gemini?: boolean; groq?: boolean; claude?: boolean; limits?: Record<string, number> } = {}) {
  const gemini = { enabled: opts.gemini ?? true, extractFromAudio: jest.fn(), extractFromText: jest.fn() };
  const groq = { enabled: opts.groq ?? true, transcribe: jest.fn() };
  const claude = { enabled: opts.claude ?? false, extractFromText: jest.fn() };
  const redis = memoryRedis();
  const categories = {
    findAll: jest.fn(async () => [
      { name: 'Transport', type: 'EXPENSE', children: [{ name: 'Taksi', type: 'EXPENSE' }] },
      { name: 'Oylik', type: 'INCOME', children: [] },
    ]),
  };
  const accounts = { findAll: jest.fn(async () => [{ name: 'Naqd pul' }]) };
  const config = { get: (key: string) => opts.limits?.[key] } as unknown as ConfigService;

  const service = new AssistantService(
    gemini as unknown as GeminiClient,
    groq as unknown as GroqSpeechToText,
    claude as unknown as ClaudeClient,
    categories as unknown as CategoriesRepository,
    accounts as unknown as AccountsRepository,
    redis as unknown as RedisService,
    clockStub() as unknown as ClockService,
    config,
  );
  return { service, gemini, groq, claude, redis };
}

describe('AssistantService.fromVoice', () => {
  it('uses one Gemini call for transcription and extraction, with names only as context', async () => {
    const { service, gemini, groq } = setup();
    gemini.extractFromAudio.mockResolvedValue(extraction());

    const outcome = await service.fromVoice(user, voice);

    expect(outcome).toMatchObject({
      status: 'ok',
      result: { transcript: 'taksiga yigirma ming', entries: [{ amount: 2_000_000n, categoryName: 'Transport' }] },
    });
    expect(gemini.extractFromAudio.mock.calls[0][2]).toMatchObject({
      expenseCategories: ['Transport', 'Taksi'],
      incomeCategories: ['Oylik'],
      accounts: ['Naqd pul'],
    });
    expect(groq.transcribe).not.toHaveBeenCalled();
  });

  it('falls back to Groq when Gemini is out of quota, and stops calling Gemini while it cools down', async () => {
    const { service, gemini, groq, redis } = setup();
    gemini.extractFromAudio.mockRejectedValue(new AssistantProviderError('gemini', 'rate_limited', 30));
    groq.transcribe.mockResolvedValue('Taksiga 20000 berdim');

    const first = await service.fromVoice(user, voice);
    const second = await service.fromVoice(user, voice);

    expect(redis.set).toHaveBeenCalledWith('ai:cooldown:gemini', '1', 30);
    expect(gemini.extractFromAudio).toHaveBeenCalledTimes(1);
    expect(gemini.extractFromText).not.toHaveBeenCalled();
    // No AI text extractor available: the local parser reads the single amount.
    for (const outcome of [first, second]) {
      expect(outcome).toMatchObject({ status: 'ok', result: { entries: [{ amount: 2_000_000n, type: 'EXPENSE' }] } });
    }
  });

  it('sends the Groq transcript to an AI text extractor when one is available', async () => {
    const { service, gemini, groq, claude } = setup({ claude: true });
    gemini.extractFromAudio.mockRejectedValue(new AssistantProviderError('gemini', 'unavailable'));
    gemini.extractFromText.mockRejectedValue(new AssistantProviderError('gemini', 'unavailable'));
    groq.transcribe.mockResolvedValue('taksiga yigirma ming, tushlikka qirq besh ming');
    claude.extractFromText.mockResolvedValue({
      ...extraction(),
      entries: [...extraction().entries, { ...extraction().entries[0], amount: '45000', note: 'tushlik' }],
    });

    const outcome = await service.fromVoice(user, voice);

    expect(claude.extractFromText).toHaveBeenCalledWith('taksiga yigirma ming, tushlikka qirq besh ming', expect.any(Object));
    expect(outcome).toMatchObject({ status: 'ok', result: { entries: [{ amount: 2_000_000n }, { amount: 4_500_000n }] } });
  });

  it('never guesses with the local parser when a transcript holds several amounts', async () => {
    const { service, gemini, groq } = setup();
    gemini.extractFromAudio.mockRejectedValue(new AssistantProviderError('gemini', 'rate_limited', 60));
    groq.transcribe.mockResolvedValue('taksi 20000, tushlik 45000');

    expect(await service.fromVoice(user, voice)).toMatchObject({ status: 'ok', result: { entries: [] } });
  });

  it('reports unavailable when every provider fails', async () => {
    const { service, gemini, groq } = setup();
    gemini.extractFromAudio.mockRejectedValue(new AssistantProviderError('gemini', 'unavailable'));
    groq.transcribe.mockRejectedValue(new AssistantProviderError('groq', 'unavailable'));

    expect(await service.fromVoice(user, voice)).toEqual({ status: 'unavailable' });
  });

  it('enforces the per-user daily limit before calling any provider', async () => {
    const { service, gemini } = setup({ limits: { VOICE_DAILY_LIMIT: 2 } });
    gemini.extractFromAudio.mockResolvedValue(extraction());

    await service.fromVoice(user, voice);
    await service.fromVoice(user, voice);
    expect(await service.fromVoice(user, voice)).toEqual({ status: 'limit' });
    expect(gemini.extractFromAudio).toHaveBeenCalledTimes(2);
  });

  it('is disabled without Gemini and Groq', async () => {
    const { service } = setup({ gemini: false, groq: false, claude: true });
    expect(await service.fromVoice(user, voice)).toEqual({ status: 'disabled' });
  });
});

describe('AssistantService.fromText', () => {
  it('does not spend quota on text without any number', async () => {
    const { service, gemini, redis } = setup();

    const outcome = await service.fromText(user, 'salom, qalaysan?');

    expect(outcome).toMatchObject({ status: 'ok', result: { entries: [] } });
    expect(gemini.extractFromText).not.toHaveBeenCalled();
    expect(redis.incrWithTtl).not.toHaveBeenCalled();
  });

  it('tries Gemini, then Claude', async () => {
    const { service, gemini, claude } = setup({ claude: true });
    gemini.extractFromText.mockRejectedValue(new AssistantProviderError('gemini', 'bad_output'));
    claude.extractFromText.mockResolvedValue(extraction('45000'));

    expect(await service.fromText(user, 'tushlikka qirq besh ming')).toMatchObject({
      status: 'ok',
      result: { entries: [{ amount: 4_500_000n }] },
    });
  });

  it('is unavailable when the only extractor fails', async () => {
    const { service, gemini } = setup();
    gemini.extractFromText.mockRejectedValue(new AssistantProviderError('gemini', 'unavailable'));
    expect(await service.fromText(user, 'yigirma ming taksi')).toEqual({ status: 'unavailable' });
  });
});

describe('looksLikeEntry', () => {
  it.each(['taksiga yigirma ming', '45k', 'обед двести тысяч', 'yarim million oylik', '100 so‘m'])('%s → true', (t) => {
    expect(looksLikeEntry(t)).toBe(true);
  });
  it.each(['salom', 'rahmat!', 'как дела?'])('%s → false', (t) => {
    expect(looksLikeEntry(t)).toBe(false);
  });
});
