/* eslint-disable no-console */
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

/**
 * E2E tests truncate tables, so they must never touch a real database. The target is derived
 * from DATABASE_URL by appending `_test` to the database name, and anything that does not end
 * in `_test` is refused outright.
 */
export function resolveTestDatabaseUrl(): string {
  loadDotenv({ path: resolve(__dirname, '../../.env') });
  loadDotenv({ path: resolve(__dirname, '../../../../.env') });

  const explicit = process.env.E2E_DATABASE_URL;
  const base = explicit ?? process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL (or E2E_DATABASE_URL) is required for e2e tests');

  const url = new URL(base);
  const dbName = url.pathname.replace(/^\//, '');
  if (!explicit && !dbName.endsWith('_test')) url.pathname = `/${dbName}_test`;

  if (!url.pathname.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests against "${url.pathname.slice(1)}" (name must end in _test)`);
  }
  return url.toString();
}

export function resolveTestRedisUrl(): string {
  const url = new URL(process.env.E2E_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
  // A dedicated logical DB keeps test cache keys and queues away from local development.
  if (!process.env.E2E_REDIS_URL) url.pathname = '/15';
  return url.toString();
}

process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.REDIS_URL = resolveTestRedisUrl();
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.SWAGGER_ENABLED = 'false';
process.env.SCHEDULER_ENABLED = 'false';
process.env.TRUST_PROXY = '1';
process.env.JWT_ACCESS_SECRET ??= 'e2e_access_secret_that_is_long_enough_32';
process.env.JWT_REFRESH_SECRET ??= 'e2e_refresh_secret_that_is_long_enough_32';
process.env.BCRYPT_ROUNDS = '10';
