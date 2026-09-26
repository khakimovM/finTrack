import { UserCacheService } from '../user-cache.service';
import { RedisService } from '../redis.service';

function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    incr: jest.fn(async (key: string) => {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    }),
  };
}

describe('UserCacheService', () => {
  it('caches per user and generation', async () => {
    const redis = fakeRedis();
    const cache = new UserCacheService(redis as unknown as RedisService);
    const compute = jest.fn().mockResolvedValue({ n: 1 });

    await cache.remember('u1', 'x', 60, compute);
    await cache.remember('u1', 'x', 60, compute);
    await cache.remember('u2', 'x', 60, compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('never serves a value computed before an invalidation that happened mid-flight', async () => {
    const redis = fakeRedis();
    const cache = new UserCacheService(redis as unknown as RedisService);

    let release: (v: { n: number }) => void = () => undefined;
    const slow = cache.remember(
      'u1',
      'x',
      60,
      () => new Promise<{ n: number }>((resolve) => (release = resolve)),
    );
    await new Promise((r) => setImmediate(r));
    await cache.invalidate('u1');
    release({ n: 1 });
    await slow;

    const fresh = await cache.remember('u1', 'x', 60, async () => ({ n: 2 }));
    expect(fresh).toEqual({ n: 2 });
  });

  it('falls back to computing when Redis is unavailable', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(null),
    };
    const cache = new UserCacheService(redis as unknown as RedisService);
    await expect(cache.remember('u1', 'x', 60, async () => 'v')).resolves.toBe('v');
  });
});
