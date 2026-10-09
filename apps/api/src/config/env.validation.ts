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
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  // Number of reverse-proxy hops in front of the API (Railway edge = 1).
  TRUST_PROXY: z
    .string()
    .regex(/^(true|false|\d+)$/, 'TRUST_PROXY must be true, false or a hop count')
    .default('1')
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : Number(v))),
  SWAGGER_ENABLED: booleanFlag.optional(),
  /** Registers the repeatable jobs on boot; e2e tests turn it off. */
  SCHEDULER_ENABLED: booleanFlag.default('true'),
  APP_TIMEZONE: z.string().default('Asia/Tashkent'),

  /** Built web app (apps/web/dist) to serve from this process; unset in development (Vite). */
  WEB_DIST_DIR: z.string().min(1).optional(),
  /** Public URL of the web app (Mini App + links sent by the bot). Defaults to CLIENT_URL. */
  WEB_APP_URL: z.string().url().optional(),
  /** Keys the one-time sign-in codes. Required in production; dev derives one from JWT_ACCESS_SECRET. */
  OTP_SECRET: z.string().min(32, 'OTP_SECRET must be at least 32 characters').optional(),

  /** Without a token the bot is disabled (local development without Telegram). */
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(/^\d+:[A-Za-z0-9_-]{30,}$/, 'TELEGRAM_BOT_TOKEN has the wrong format')
    .optional(),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .regex(/^[A-Za-z0-9_]{5,32}$/, 'TELEGRAM_BOT_USERNAME without the @')
    .optional(),
  /** Set in production (HTTPS). When empty the bot uses long polling. */
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  /** Echoed by Telegram in X-Telegram-Bot-Api-Secret-Token; Telegram allows [A-Za-z0-9_-]{1,256}. */
  TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .regex(/^[A-Za-z0-9_-]{32,256}$/, 'TELEGRAM_WEBHOOK_SECRET: 32-256 chars of A-Z a-z 0-9 _ -')
    .optional(),
  /** Alternative Bot API server (local Bot API server or a test double). */
  TELEGRAM_API_ROOT: z.string().url().optional(),
  /** Telegram user ids allowed into the admin panel, comma-separated. Unset = no admin panel. */
  ADMIN_TELEGRAM_IDS: z
    .string()
    .regex(/^\d{5,15}(\s*,\s*\d{5,15})*$/, 'ADMIN_TELEGRAM_IDS: comma-separated Telegram user ids')
    .optional(),

  /** Voice notes and free text: Gemini (free tier) transcribes and extracts entries. */
  GEMINI_API_KEY: z.string().min(20, 'GEMINI_API_KEY looks too short').optional(),
  /** Tried in order; each model has its own free-tier quota. Unset = the built-in chain. */
  GEMINI_MODELS: z
    .string()
    .regex(/^[a-z0-9.-]+(s*,s*[a-z0-9.-]+)*$/, 'GEMINI_MODELS: comma-separated model ids')
    .optional(),
  /** Fallback speech-to-text (Groq Whisper) when Gemini is out of quota. */
  GROQ_API_KEY: z.string().min(20, 'GROQ_API_KEY looks too short').optional(),
  GROQ_STT_MODEL: z.string().regex(/^[a-z0-9.-]+$/, 'GROQ_STT_MODEL: a model id').default('whisper-large-v3'),
  /** Optional paid text extractor. */
  ANTHROPIC_API_KEY: z.string().min(20, 'ANTHROPIC_API_KEY looks too short').optional(),
  ANTHROPIC_MODEL: z.string().regex(/^[a-z0-9.-]+$/, 'ANTHROPIC_MODEL: a model id').default('claude-opus-5'),
  VOICE_MAX_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  /** Per user per day; protects the free quotas from a single chatty user. */
  VOICE_DAILY_LIMIT: z.coerce.number().int().min(0).default(30),
  AI_TEXT_DAILY_LIMIT: z.coerce.number().int().min(0).default(50),
});

export type EnvConfig = z.infer<typeof envSchema>;

function crossFieldIssues(env: EnvConfig): string[] {
  const issues: string[] = [];
  if (env.NODE_ENV === 'production') {
    if (!env.OTP_SECRET) issues.push('OTP_SECRET: required in production');
    if (!env.TELEGRAM_BOT_TOKEN) issues.push('TELEGRAM_BOT_TOKEN: required in production');
    if (!env.TELEGRAM_WEBHOOK_URL) issues.push('TELEGRAM_WEBHOOK_URL: required in production');
  }
  if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_BOT_USERNAME) {
    issues.push('TELEGRAM_BOT_USERNAME: required together with TELEGRAM_BOT_TOKEN');
  }
  if (env.TELEGRAM_WEBHOOK_URL && !env.TELEGRAM_WEBHOOK_SECRET) {
    issues.push('TELEGRAM_WEBHOOK_SECRET: required together with TELEGRAM_WEBHOOK_URL');
  }
  if (!isValidTimeZone(env.APP_TIMEZONE)) issues.push('APP_TIMEZONE: unknown IANA time zone');
  return issues;
}

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

  const crossField = crossFieldIssues(result.data);
  if (crossField.length > 0) {
    throw new Error(`Environment validation failed:\n${crossField.map((i) => `  - ${i}`).join('\n')}`);
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
