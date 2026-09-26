/** Plain options accepted by both ioredis (cache) and BullMQ's bundled ioredis (queues). */
export interface RedisConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
  family: number;
  maxRetriesPerRequest: null;
}

/**
 * BullMQ needs discrete connection options (and `maxRetriesPerRequest: null`) rather than a URL.
 * `rediss://` URLs (managed Redis with TLS) keep TLS enabled; `family: 0` lets Railway's
 * IPv6-only private network resolve.
 */
export function redisConnectionOptions(redisUrl: string): RedisConnectionConfig {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    family: 0,
    maxRetriesPerRequest: null,
  };
}
