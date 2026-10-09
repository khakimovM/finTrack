import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConnectionOptions } from './redis-connection';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis({
      ...redisConnectionOptions(redisUrl),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      // Keep reconnecting forever: giving up would leave the cache permanently disabled
      // after a short Redis restart on the hosting platform.
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });

    this.client.connect().catch((err) => {
      this.logger.warn(`Failed to connect to Redis on startup: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis GET error for key ${key}: ${message}`);
      return null;
    }
  }

  /** MGET: one round trip for many keys; missing keys (or no Redis) read as null. */
  async getMany(keys: string[]): Promise<Array<string | null>> {
    if (!this.client || keys.length === 0) return keys.map(() => null);
    try {
      return await this.client.mget(keys);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis MGET error for ${keys.length} keys: ${message}`);
      return keys.map(() => null);
    }
  }

  /** HGETALL; an absent hash (or no Redis) reads as empty. */
  async hashGetAll(key: string): Promise<Record<string, string>> {
    if (!this.client) return {};
    try {
      return await this.client.hgetall(key);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis HGETALL error for key ${key}: ${message}`);
      return {};
    }
  }

  /** HSET of several fields, and the whole hash expires `ttlSeconds` after the last write. */
  async hashSet(key: string, fields: Record<string, string>, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.multi().hset(key, fields).expire(key, ttlSeconds).exec();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis HSET error for key ${key}: ${message}`);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (!this.client) return null;
    try {
      if (ttlSeconds) {
        return await this.client.set(key, value, 'EX', ttlSeconds);
      }
      return await this.client.set(key, value);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis SET error for key ${key}: ${message}`);
      return null;
    }
  }

  /** SET NX EX: true only for the first caller (idempotency guards for jobs). Fails closed. */
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis SETNX error for key ${key}: ${message}`);
      return false;
    }
  }

  /** GETDEL: reads and removes in one step (one-shot conversation state). */
  async take(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.getdel(key);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis GETDEL error for key ${key}: ${message}`);
      return null;
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      return await this.client.incr(key);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis INCR error for key ${key}: ${message}`);
      return null;
    }
  }

  /** Atomically increments a counter and sets its TTL on first use (rate limits, quotas). */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    if (!this.client) return null;
    try {
      const [[, count]] = (await this.client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec()) as [
        [Error | null, number],
        [Error | null, number],
      ];
      return count;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis INCR/EXPIRE error for key ${key}: ${message}`);
      return null;
    }
  }

  async del(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.del(key);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis DEL error for key ${key}: ${message}`);
      return 0;
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis delPattern error for pattern ${pattern}: ${message}`);
    }
  }

  async ping(): Promise<string> {
    if (!this.client) return 'NOT_CONNECTED';
    return await this.client.ping();
  }
}
