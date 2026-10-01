import { ConfigService } from '@nestjs/config';
import { Messages } from '@anthropic-ai/sdk/resources/messages/messages';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_GEMINI_MODELS, GeminiClient, retryDelaySeconds } from '../providers/gemini.client';
import { RedisService } from '../../../infra/redis/redis.service';
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

/** In-memory stand-in for the cooldown keys. */
function memoryRedis() {
  const store = new Map<string, { value: string; ttl?: number }>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key)?.value ?? null),
    set: jest.fn(async (key: string, value: string, ttl?: number) => {
      store.set(key, { value, ttl });
      return 'OK' as const;
    }),
  };
}

describe('GeminiClient', () => {
  // Spies are created per test: a restored spy would let requests reach the real network.
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let redis: ReturnType<typeof memoryRedis>;
  let gemini: GeminiClient;
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    redis = memoryRedis();
    gemini = new GeminiClient(
      config({ GEMINI_API_KEY: 'g'.repeat(39), GEMINI_MODELS: 'model-a, model-b' }),
      redis as unknown as RedisService,
    );
  });
  afterEach(() => fetchMock.mockRestore());

  const ok = (text: string, finishReason = 'STOP') =>
    jsonResponse(200, { candidates: [{ content: { parts: [{ text }] }, finishReason }] });
  const quotaExceeded = () =>
    jsonResponse(429, {
      error: {
        message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 5\nPlease retry in 44.88s.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '44s' }],
      },
    });
  const modelOf = (call: number) => /models\/([^:]+):/.exec(String(fetchMock.mock.calls[call][0]))?.[1];

  it('sends the audio inline with the schema and returns the validated answer', async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify(answer)));

    await expect(gemini.extractFromAudio(Buffer.from('OggS'), 'audio/ogg', ctx)).resolves.toEqual(answer);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/models/model-a:generateContent');
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

  it('moves to the next model when one is out of quota and skips it until its retry delay ends', async () => {
    // A Response body can be read once: every call needs a fresh one.
    fetchMock.mockResolvedValueOnce(quotaExceeded()).mockImplementation(async () => ok(JSON.stringify(answer)));

    await expect(gemini.extractFromText('x', ctx)).resolves.toEqual(answer);
    await expect(gemini.extractFromText('y', ctx)).resolves.toEqual(answer);

    expect([modelOf(0), modelOf(1), modelOf(2)]).toEqual(['model-a', 'model-b', 'model-b']);
    expect(redis.store.get('ai:cooldown:gemini:model-a')).toEqual({ value: '1', ttl: 44 });
  });

  it.each([
    ['an overloaded model (503)', () => jsonResponse(503, {}), 30],
    ['a model the key cannot use (404)', () => jsonResponse(404, {}), 3600],
  ])('falls through %s and pauses it', async (_label, response, ttl) => {
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValue(ok(JSON.stringify(answer)));

    await expect(gemini.extractFromText('x', ctx)).resolves.toEqual(answer);
    expect(redis.store.get('ai:cooldown:gemini:model-a')?.ttl).toBe(ttl);
  });

  it('does not call the API at all while every model cools down', async () => {
    await redis.set('ai:cooldown:gemini:model-a', '1', 10);
    await redis.set('ai:cooldown:gemini:model-b', '1', 10);

    const err = await failure(gemini.extractFromText('x', ctx));

    expect(err).toMatchObject({ provider: 'gemini', reason: 'rate_limited', retryAfterSeconds: undefined });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a blocked prompt', () => jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } }), 'rejected'],
    ['a truncated answer', () => ok('{"transcript":', 'MAX_TOKENS'), 'bad_output'],
    ['JSON that breaks the schema', () => ok('{"transcript":1}'), 'bad_output'],
    ['a network error', () => Promise.reject(new Error('ECONNRESET')), 'unavailable'],
  ])('reports %s once every model has failed', async (_label, response, reason) => {
    fetchMock.mockImplementation(() => response() as Promise<Response>);
    expect(await failure(gemini.extractFromText('x', ctx))).toMatchObject({ provider: 'gemini', reason });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('is disabled without a key', () => {
    expect(new GeminiClient(config({}), redis as unknown as RedisService).enabled).toBe(false);
  });

  it('defaults to the built-in model chain', () => {
    expect(new GeminiClient(config({}), redis as unknown as RedisService).models).toEqual(
      DEFAULT_GEMINI_MODELS.split(','),
    );
  });
});

describe('retryDelaySeconds', () => {
  it('reads RetryInfo, then the message, and rounds up', () => {
    expect(retryDelaySeconds({ error: { details: [{ retryDelay: '44.2s' }] } })).toBe(45);
    expect(retryDelaySeconds({ error: { message: 'Please retry in 12.5s.' } })).toBe(13);
    expect(retryDelaySeconds({ error: { message: 'nothing here' } })).toBeNull();
    expect(retryDelaySeconds(null)).toBeNull();
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
