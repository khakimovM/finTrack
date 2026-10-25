import { TtsService } from '../tts.service';
import { SpeechLocale, SpeechProvider, SpeechProviderError } from '../tts.types';
import { RedisService } from '../../redis/redis.service';
import { ClockService } from '../../clock/clock.service';

type Answer = Buffer | SpeechProviderError;

function provider(id: string, free: boolean, answers: Answer[] = [], monthlyChars: number | null = null) {
  const synthesize = jest.fn(async (_text: string, _locale: SpeechLocale) => {
    const answer = answers.shift() ?? Buffer.from(id);
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const p: SpeechProvider = { id, free, monthlyChars, minIntervalMs: 0, synthesize };
  return Object.assign(p, { synthesize });
}

/** Just enough of Redis: values and their TTLs. */
function memoryRedis() {
  const values = new Map<string, string>();
  const ttls = new Map<string, number>();
  const redis = {
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, ttl?: number) => {
      values.set(key, value);
      if (ttl !== undefined) ttls.set(key, ttl);
      return 'OK' as const;
    }),
    incrByWithTtl: jest.fn(async (key: string, by: number, ttl: number) => {
      const next = Number(values.get(key) ?? 0) + by;
      values.set(key, String(next));
      if (!ttls.has(key)) ttls.set(key, ttl);
      return next;
    }),
  };
  return { redis, values, ttls };
}

function setup(providers: SpeechProvider[]) {
  const memory = memoryRedis();
  const clock = { now: () => new Date('2026-10-31T16:00:00.000Z') };
  const service = new TtsService(providers, memory.redis as unknown as RedisService, clock as unknown as ClockService);
  return { service, ...memory };
}

describe('TtsService', () => {
  it('uses the free accounts first, whatever order they are given in, and meters the characters', async () => {
    const paid = provider('azure-paid', false);
    const free = provider('azure-free', true, [], 500_000);
    const { service, values, ttls } = setup([paid, free]);

    expect(await service.speak('Salom', 'uz')).toEqual({ audio: Buffer.from('azure-free'), provider: 'azure-free' });
    expect(paid.synthesize).not.toHaveBeenCalled();
    expect(free.synthesize).toHaveBeenCalledWith('Salom', 'uz');
    expect(values.get('tts:chars:azure-free:2026-10')).toBe('5');
    expect(ttls.get('tts:chars:azure-free:2026-10')).toBe(40 * 24 * 3600);
  });

  it('moves on before a free allowance is spent: 95% of it, counting the text about to be read', async () => {
    const azure = provider('azure-free', true, [], 1_000);
    const gemini = provider('gemini-free', true);
    const { service, values } = setup([azure, gemini]);
    values.set('tts:chars:azure-free:2026-10', '900');

    expect((await service.speak('x'.repeat(50), 'uz'))?.provider).toBe('azure-free');
    expect((await service.speak('x', 'uz'))?.provider).toBe('gemini-free');
    expect(azure.synthesize).toHaveBeenCalledTimes(1);
  });

  it('leaves a refusing provider alone for a while and tries the next one, the paid one last', async () => {
    const azure = provider('azure-free', true, [new SpeechProviderError('auth', 'azure: 403')], 500_000);
    const gemini = provider('gemini-free', true, [new SpeechProviderError('failed', 'gemini: 500')]);
    const paid = provider('gemini-paid', false);
    const { service, ttls } = setup([azure, gemini, paid]);

    expect((await service.speak('Salom', 'uz'))?.provider).toBe('gemini-paid');
    expect(ttls.get('tts:off:azure-free')).toBe(3600);
    expect(ttls.get('tts:off:gemini-free')).toBe(300);

    await service.speak('Yana', 'uz');
    expect(azure.synthesize).toHaveBeenCalledTimes(1);
    expect(gemini.synthesize).toHaveBeenCalledTimes(1);
    expect(paid.synthesize).toHaveBeenCalledTimes(2);
  });

  it('waits out a short "too many requests" once on the same provider', async () => {
    const azure = provider('azure-free', true, [new SpeechProviderError('rate', 'azure: 429', 0)], 500_000);
    const { service, values } = setup([azure]);

    expect((await service.speak('Salom', 'uz'))?.provider).toBe('azure-free');
    expect(azure.synthesize).toHaveBeenCalledTimes(2);
    expect(values.has('tts:off:azure-free')).toBe(false);
  });

  it('does not wait for a long one: the provider rests as long as it asked and the next one reads', async () => {
    const gemini = provider('gemini-free', true, [new SpeechProviderError('rate', 'gemini: 429', 3_600)]);
    const azure = provider('azure-paid', false);
    const { service, ttls } = setup([gemini, azure]);

    expect((await service.speak('Salom', 'uz'))?.provider).toBe('azure-paid');
    expect(gemini.synthesize).toHaveBeenCalledTimes(1);
    expect(ttls.get('tts:off:gemini-free')).toBe(3_600);
  });

  it('answers null without providers or when every one refuses, so the text goes alone', async () => {
    expect(await setup([]).service.speak('Salom', 'uz')).toBeNull();
    const broken = provider('azure-free', true, [new SpeechProviderError('failed', 'down')], 500_000);
    expect(await setup([broken]).service.speak('Salom', 'uz')).toBeNull();
  });

  it('reports this month’s use per provider for the admin page', async () => {
    const azure = provider('azure-free', true, [], 500_000);
    const gemini = provider('gemini-free', true);
    const { service, values } = setup([azure, gemini]);
    values.set('tts:chars:azure-free:2026-10', '12400');
    values.set('tts:off:gemini-free', 'rate');

    expect(await service.usage()).toEqual([
      { provider: 'azure-free', free: true, chars: 12_400, limit: 500_000, available: true },
      { provider: 'gemini-free', free: true, chars: 0, limit: null, available: false },
    ]);
  });
});
