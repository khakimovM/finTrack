import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheCodec<T> {
  encode(value: T): string;
  decode(raw: string): T;
}

const jsonCodec = <T>(): CacheCodec<T> => ({
  encode: (value) => JSON.stringify(value),
  decode: (raw) => JSON.parse(raw) as T,
});

/**
 * Per-user read cache with generation-based invalidation. Every key embeds the user's current
 * generation; a write bumps the generation instead of deleting keys. A read that raced a write
 * can only store its stale result under the old generation, which nobody reads again — deleting
 * keys cannot give that guarantee (the stale SET can land after the DEL).
 */
@Injectable()
export class UserCacheService {
  constructor(private readonly redis: RedisService) {}

  async remember<T>(
    userId: string,
    name: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
    codec: CacheCodec<T> = jsonCodec<T>(),
  ): Promise<T> {
    const generation = (await this.redis.get(this.generationKey(userId))) ?? '0';
    const key = `cache:${userId}:g${generation}:${name}`;

    const cached = await this.redis.get(key);
    if (cached !== null) {
      try {
        return codec.decode(cached);
      } catch {
        // Corrupted entry: fall through and recompute.
      }
    }

    const value = await compute();
    await this.redis.set(key, codec.encode(value), ttlSeconds);
    return value;
  }

  /** Call after every committed write that can change balances, stats or budgets. */
  async invalidate(userId: string): Promise<void> {
    await this.redis.incr(this.generationKey(userId));
  }

  private generationKey(userId: string): string {
    return `cachegen:${userId}`;
  }
}
