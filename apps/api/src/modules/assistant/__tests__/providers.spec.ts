import { ConfigService } from '@nestjs/config';
import { Messages } from '@anthropic-ai/sdk/resources/messages/messages';
import Anthropic from '@anthropic-ai/sdk';
import { GeminiClient } from '../providers/gemini.client';
import { GroqSpeechToText } from '../providers/groq-stt.client';
import { ClaudeClient } from '../providers/claude.client';
import { AssistantProviderError } from '../assistant.types';

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const ctx = { today: '2026-09-28', expenseCategories: ['Transport'], incomeCategories: ['Oylik'], accounts: ['Naqd pul'] };
const answer = { transcript: 'taksiga 20 ming', entries: [], debtMentioned: false };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

async function failure(promise: Promise<unknown>): Promise<AssistantProviderError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AssistantProviderError) return err;
    throw err;
  }
  throw new Error('expected a provider error');
}

describe('GeminiClient', () => {
  // Spies are created per test: a restored spy would let requests reach the real network.
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());
  const gemini = new GeminiClient(config({ GEMINI_API_KEY: 'g'.repeat(39), GEMINI_MODEL: 'gemini-test' }));
  const ok = (text: string, finishReason = 'STOP') =>
    jsonResponse(200, { candidates: [{ content: { parts: [{ text }] }, finishReason }] });


  it('sends the audio inline with the schema and returns the validated answer', async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify(answer)));

    await expect(gemini.extractFromAudio(Buffer.from('OggS'), 'audio/ogg', ctx)).resolves.toEqual(answer);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('g'.repeat(39));
    const body = JSON.parse(String(init?.body));
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'audio/ogg', data: 'T2dnUw==' } });
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json' });
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
  });

  it('ignores thought parts', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: JSON.stringify(answer) }] }, finishReason: 'STOP' }],
      }),
    );
    await expect(gemini.extractFromText('x', ctx)).resolves.toEqual(answer);
  });

  it.each([
    ['a 429 with its retry-after', () => jsonResponse(429, {}, { 'retry-after': '17' }), 'rate_limited', 17],
    ['a 5xx', () => jsonResponse(503, {}), 'unavailable', undefined],
    ['a 4xx', () => jsonResponse(400, {}), 'rejected', undefined],
    ['a blocked prompt', () => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }), 'rejected', undefined],
    ['a truncated answer', () => ok('{"transcript":', 'MAX_TOKENS'), 'bad_output', undefined],
    ['JSON that breaks the schema', () => ok('{"transcript":1}'), 'bad_output', undefined],
  ])('maps %s', async (_label, response, reason, retryAfter) => {
    fetchMock.mockResolvedValue(response());
    const err = await failure(gemini.extractFromText('x', ctx));
    expect(err).toMatchObject({ provider: 'gemini', reason });
    if (retryAfter) expect(err.retryAfterSeconds).toBe(retryAfter);
  });

  it('treats network errors and timeouts as unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    expect(await failure(gemini.extractFromText('x', ctx))).toMatchObject({ reason: 'unavailable' });
  });

  it('is disabled without a key', () => {
    expect(new GeminiClient(config({})).enabled).toBe(false);
  });
});

describe('GroqSpeechToText', () => {
  // Spies are created per test: a restored spy would let requests reach the real network.
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());
  const groq = new GroqSpeechToText(config({ GROQ_API_KEY: 'gsk_'.padEnd(40, 'x') }));


  it('uploads the file as multipart without forcing a language', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { text: ' Taksiga 20 000 so‘m. ' }));

    await expect(groq.transcribe(Buffer.from('OggS'), 'voice.ogg', 'audio/ogg')).resolves.toBe('Taksiga 20 000 so‘m.');

    const init = fetchMock.mock.calls[0][1];
    const form = init?.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3');
    expect(form.get('language')).toBeNull();
    expect((form.get('file') as File).name).toBe('voice.ogg');
    expect((init?.headers as Record<string, string>).authorization).toMatch(/^Bearer gsk_/);
  });

  it('reports rate limits so the assistant can cool down', async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, {}, { 'retry-after': '5' }));
    expect(await failure(groq.transcribe(Buffer.from('x'), 'v.ogg', 'audio/ogg'))).toMatchObject({
      provider: 'groq',
      reason: 'rate_limited',
      retryAfterSeconds: 5,
    });
  });
});

describe('ClaudeClient', () => {
  let create: jest.SpiedFunction<Messages['create']>;
  beforeEach(() => {
    create = jest.spyOn(Messages.prototype, 'create');
  });
  afterEach(() => create.mockRestore());
  const claude = new ClaudeClient(config({ ANTHROPIC_API_KEY: 'sk-ant-'.padEnd(40, 'x') }));
  const message = (over: Partial<Anthropic.Message>) =>
    ({ content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', ...over }) as Anthropic.Message;


  it('asks for the JSON schema at low effort with server-side fallbacks', async () => {
    create.mockResolvedValue(message({}) as never);

    await expect(claude.extractFromText('taksiga yigirma ming', ctx)).resolves.toEqual(answer);

    const [body, options] = create.mock.calls[0] as unknown as [Record<string, unknown>, { headers: Record<string, string> }];
    expect(body).toMatchObject({
      model: 'claude-opus-5',
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    expect(options.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
  });

  it('never reads the content of a refusal', async () => {
    create.mockResolvedValue(message({ stop_reason: 'refusal' }) as never);
    expect(await failure(claude.extractFromText('x', ctx))).toMatchObject({ provider: 'claude', reason: 'rejected' });
  });

  it('is disabled without a key', () => {
    expect(new ClaudeClient(config({})).enabled).toBe(false);
  });
});
