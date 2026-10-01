import { execSync } from 'child_process';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { resolveTestDatabaseUrl, resolveTestRedisUrl } from './test-env';

/** Brings the throwaway `_test` database to the latest migration and empties it once per run. */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = resolveTestDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (tables.length > 0) {
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }

  // Rate-limit counters and caches from a previous run would leak into this one.
  const redisUrl = resolveTestRedisUrl();
  if (new URL(redisUrl).pathname === '/15') {
    const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await redis.connect();
      await redis.flushdb();
    } finally {
      redis.disconnect();
    }
  }
}
