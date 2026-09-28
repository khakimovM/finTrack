/**
 * Starts what the browser tests talk to, in production shape: a mock Telegram Bot API, then the
 * built API serving the built web app from one origin. Run with Node's type stripping
 * (`node e2e/support/start-stack.ts`); needs `npm run build` first.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E } from './env.ts';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiDir = path.resolve(webDir, '../api');

if (existsSync(path.join(apiDir, '.env'))) process.loadEnvFile(path.join(apiDir, '.env'));

/** Browser tests truncate nothing, but they must still never write to a real database. */
function testDatabaseUrl(): string {
  const base = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL (or E2E_DATABASE_URL) is required');
  const url = new URL(base);
  if (!process.env.E2E_DATABASE_URL && !url.pathname.endsWith('_test')) url.pathname = `${url.pathname}_test`;
  if (!url.pathname.endsWith('_test')) throw new Error(`Refusing to use "${url.pathname}" (name must end in _test)`);
  return url.toString();
}

function testRedisUrl(): string {
  const url = new URL(process.env.E2E_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
  // DB 15 belongs to the API's Jest e2e suite; the browser suite uses its own.
  if (!process.env.E2E_REDIS_URL) url.pathname = '/14';
  return url.toString();
}

// ---------------------------------------------------------------------------
// Mock Telegram Bot API: records what the bot sends, answers every method with ok.
// ---------------------------------------------------------------------------
interface SentMessage {
  chatId: number;
  text: string;
}
const sent: SentMessage[] = [];
let messageId = 1;

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function reply(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const telegram = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/__messages') {
    const chatId = Number(url.searchParams.get('chat_id'));
    return reply(res, sent.filter((m) => m.chatId === chatId).map((m) => m.text));
  }

  const method = /^\/bot[^/]+\/(\w+)$/.exec(url.pathname)?.[1];
  if (!method) {
    res.writeHead(404);
    return res.end();
  }
  const payload = await readJson(req);
  if (method === 'getMe') {
    return reply(res, {
      ok: true,
      result: { id: 999_999, is_bot: true, first_name: 'FinTrack', username: E2E.botUsername, can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false },
    });
  }
  if (method === 'sendMessage') {
    const chatId = Number(payload.chat_id);
    sent.push({ chatId, text: String(payload.text) });
    return reply(res, {
      ok: true,
      result: { message_id: messageId++, date: Math.floor(Date.now() / 1000), chat: { id: chatId, type: 'private' }, text: payload.text },
    });
  }
  return reply(res, { ok: true, result: true });
});

// ---------------------------------------------------------------------------
// API (+ web build)
// ---------------------------------------------------------------------------
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(E2E.apiPort),
  LOG_LEVEL: 'warn',
  DATABASE_URL: testDatabaseUrl(),
  REDIS_URL: testRedisUrl(),
  JWT_ACCESS_SECRET: 'playwright_access_secret_long_enough_32ch',
  JWT_REFRESH_SECRET: 'playwright_refresh_secret_long_enough_32c',
  OTP_SECRET: 'playwright_otp_secret_that_is_long_enough',
  CLIENT_URL: `http://localhost:${E2E.apiPort}`,
  WEB_APP_URL: '',
  WEB_DIST_DIR: path.join(webDir, 'dist'),
  TELEGRAM_BOT_TOKEN: E2E.botToken,
  TELEGRAM_BOT_USERNAME: E2E.botUsername,
  TELEGRAM_WEBHOOK_SECRET: E2E.webhookSecret,
  TELEGRAM_WEBHOOK_URL: '',
  TELEGRAM_API_ROOT: `http://127.0.0.1:${E2E.telegramPort}`,
  SCHEDULER_ENABLED: 'false',
  SWAGGER_ENABLED: 'false',
  GEMINI_API_KEY: '',
  GROQ_API_KEY: '',
  ANTHROPIC_API_KEY: '',
};

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: apiDir, env, stdio: 'inherit', shell: true });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

telegram.listen(E2E.telegramPort, '127.0.0.1', () => {
  const api = spawn(process.execPath, [path.join(apiDir, 'dist/main.js')], { cwd: apiDir, env, stdio: 'inherit' });
  const stop = () => {
    api.kill();
    telegram.close();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  api.on('exit', (code) => {
    telegram.close();
    process.exit(code ?? 0);
  });
});
