import { z } from 'zod';

// `z.coerce.boolean()` treats any non-empty string (including "false") as true.
const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const secret = (name: string) =>
  z
    .string({ required_error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters`);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('api'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL is required' }).min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string({ required_error: 'REDIS_URL is required' }).min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
  ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/, 'ACCESS_TOKEN_TTL must look like 15m').default('15m'),
  REFRESH_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/, 'REFRESH_TOKEN_TTL must look like 7d').default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(12),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  // Number of reverse-proxy hops in front of the API (Railway edge = 1, Vercel rewrite + Railway = 2).
  TRUST_PROXY: z
    .string()
    .regex(/^(true|false|\d+)$/, 'TRUST_PROXY must be true, false or a hop count')
    .default('1')
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : Number(v))),
  SWAGGER_ENABLED: booleanFlag.optional(),
  /** Registers the repeatable jobs on boot; e2e tests turn it off. */
  SCHEDULER_ENABLED: booleanFlag.default('true'),
  APP_TIMEZONE: z.string().default('Asia/Tashkent'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  // `KEY=` in a .env file means "unset", not "empty value": let defaults apply.
  const normalized = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
  const result = envSchema.safeParse(normalized);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }

  if (!isValidTimeZone(result.data.APP_TIMEZONE)) {
    throw new Error(`Environment validation failed:\n  - APP_TIMEZONE: unknown IANA time zone`);
  }

  return result.data;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
