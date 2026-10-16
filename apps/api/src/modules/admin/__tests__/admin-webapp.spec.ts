import { createHmac } from 'crypto';
import { HttpException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAccessService } from '../core/admin-access.service';
import { AdminAuditService } from '../core/admin-audit.service';
import { ADMIN_INIT_DATA_MAX_AGE_SECONDS, AdminAuthService } from '../admin-auth.service';
import { AdminSessionService } from '../admin-session.service';
import { TelegramLoginService } from '../../auth/telegram-login.service';
import { AuthRepository } from '../../auth/auth.repository';
import { ClockService } from '../../../infra/clock/clock.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';

const BOT_TOKEN = '123456:unit-test-token';
const OWNER = 7001;
const STRANGER = 8002;

/** Launch data as Telegram signs it for a Mini App opened from the bot's /admin button. */
function initData(userId: number, ageSeconds = 5): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000) - ageSeconds),
    query_id: `q${Math.random().toString(36).slice(2)}`,
    user: JSON.stringify({ id: userId, first_name: 'Ega', username: `u${userId}` }),
  };
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const lines = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  return new URLSearchParams({ ...fields, hash: createHmac('sha256', secret).update(lines).digest('hex') }).toString();
}

function setup(adminIds = String(OWNER)) {
  const users = new Map([
    [BigInt(OWNER), { id: 'owner', name: 'Ega', telegramUsername: 'ega', telegramId: BigInt(OWNER), timezone: 'Asia/Tashkent' }],
    [BigInt(STRANGER), { id: 'stranger', name: 'Begona', telegramUsername: null, telegramId: BigInt(STRANGER), timezone: 'Asia/Tashkent' }],
  ]);
  const used = new Set<string>();
  const sessions = { create: jest.fn(async () => ({ token: 'admin-token', expiresAt: new Date(Date.now() + 8 * 3600_000) })) };
  const audit = { record: jest.fn(async () => undefined) };
  const telegram = { send: jest.fn(async () => 'SENT') };
  const service = new AdminAuthService(
    new AdminAccessService({ get: () => adminIds } as unknown as ConfigService),
    {} as TelegramLoginService,
    sessions as unknown as AdminSessionService,
    { findUserByTelegramId: jest.fn(async (id: bigint) => users.get(id) ?? null) } as unknown as AuthRepository,
    audit as unknown as AdminAuditService,
    telegram as unknown as TelegramBotService,
    { now: () => new Date() } as unknown as ClockService,
    {
      setIfAbsent: jest.fn(async (key: string) => {
        if (used.has(key)) return false;
        used.add(key);
        return true;
      }),
    } as unknown as RedisService,
    { get: (key: string) => (key === 'TELEGRAM_BOT_TOKEN' ? BOT_TOKEN : undefined) } as unknown as ConfigService,
  );
  return { service, sessions, audit, telegram };
}

async function errorCode(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof HttpException) return (err.getResponse() as { code?: string }).code ?? err.getStatus();
    throw err;
  }
  throw new Error('expected the sign-in to be refused');
}

describe('AdminAuthService.webApp (the bot’s /admin button)', () => {
  it('opens an admin session for the owner and records it as a Mini App sign-in', async () => {
    const t = setup();
    const result = await t.service.webApp(initData(OWNER), { ipAddress: '1.2.3.4', userAgent: 'Mozilla/5.0 (iPhone)' });

    expect(result.token).toBe('admin-token');
    expect(result.session.admin).toEqual({ id: 'owner', name: 'Ega', telegramUsername: 'ega' });
    expect(t.sessions.create).toHaveBeenCalledWith('owner', expect.objectContaining({ ipAddress: '1.2.3.4' }));
    expect(t.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN', adminUserId: 'owner', meta: expect.objectContaining({ via: 'miniapp' }) }),
    );
    // Every admin sign-in is announced in the owner's chat, this one too.
    await new Promise((resolve) => setImmediate(resolve));
    expect(t.telegram.send).toHaveBeenCalledWith(BigInt(OWNER), expect.stringContaining('Admin panelga kirildi'), { html: true });
  });

  it('lets each launch in once: a reload or a copy of the launch data has to reopen the panel', async () => {
    const t = setup();
    const data = initData(OWNER);
    await t.service.webApp(data, {});
    await expect(errorCode(t.service.webApp(data, {}))).resolves.toBe('TELEGRAM_INIT_DATA_EXPIRED');
    expect(t.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('accepts launch data only within ten minutes of opening', async () => {
    const t = setup();
    await expect(t.service.webApp(initData(OWNER, ADMIN_INIT_DATA_MAX_AGE_SECONDS - 30), {})).resolves.toBeDefined();
    await expect(errorCode(t.service.webApp(initData(OWNER, ADMIN_INIT_DATA_MAX_AGE_SECONDS + 30), {}))).resolves.toBe(
      'TELEGRAM_INIT_DATA_EXPIRED',
    );
  });

  it('refuses launch data the bot did not sign', async () => {
    const t = setup();
    const forged = initData(OWNER).replace(encodeURIComponent(`"id":${OWNER}`), encodeURIComponent('"id":7002'));
    await expect(errorCode(t.service.webApp(forged, {}))).resolves.toBe('TELEGRAM_INIT_DATA_INVALID');
    await expect(errorCode(t.service.webApp('hash=abc', {}))).resolves.toBe('TELEGRAM_INIT_DATA_INVALID');
    expect(t.sessions.create).not.toHaveBeenCalled();
  });

  it('answers anyone else with the panel’s usual 404 and records the attempt', async () => {
    const t = setup();
    await expect(t.service.webApp(initData(STRANGER), { ipAddress: '5.6.7.8' })).rejects.toBeInstanceOf(NotFoundException);
    expect(t.sessions.create).not.toHaveBeenCalled();
    expect(t.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_DENIED',
        telegramId: BigInt(STRANGER),
        meta: expect.objectContaining({ reason: 'not_admin', via: 'miniapp' }),
      }),
    );

    // An admin id with no FinTrack account yet.
    const unregistered = setup(`${OWNER},9003`);
    await expect(unregistered.service.webApp(initData(9003), {})).rejects.toBeInstanceOf(NotFoundException);
    expect(unregistered.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_DENIED', meta: expect.objectContaining({ reason: 'no_account' }) }),
    );
  });
});
