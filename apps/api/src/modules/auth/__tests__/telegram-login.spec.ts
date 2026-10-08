import { ConfigService } from '@nestjs/config';
import { TelegramLoginRequest } from '@prisma/client';
import { LoginCodeService, MAX_CODES_PER_WINDOW } from '../login-code.service';
import { TelegramLoginRepository } from '../telegram-login.repository';
import { TelegramLoginBotService } from '../telegram-login-bot.service';
import { AuthRepository } from '../auth.repository';
import { SessionStateService } from '../session-state.service';
import { LOGIN_TEXT, describeDevice, escapeHtml } from '../telegram-login.messages';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { AdminAccessService } from '../../admin/core/admin-access.service';
import { AdminAuditService } from '../../admin/core/admin-audit.service';

function request(overrides: Partial<TelegramLoginRequest> = {}): TelegramLoginRequest {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    purpose: 'LOGIN',
    nonceHash: 'n',
    status: 'PENDING',
    userId: null,
    telegramId: null,
    codeHash: null,
    codeExpiresAt: null,
    attempts: 0,
    codesSent: 0,
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function codeService(sentInWindow = 1) {
  const repository = { update: jest.fn() };
  const telegram = { send: jest.fn().mockResolvedValue('SENT') };
  const redis = { incrWithTtl: jest.fn().mockResolvedValue(sentInWindow) };
  const config = { get: jest.fn((key: string) => (key === 'OTP_SECRET' ? 'x'.repeat(40) : undefined)) };
  const service = new LoginCodeService(
    config as unknown as ConfigService,
    repository as unknown as TelegramLoginRepository,
    telegram as unknown as TelegramBotService,
    redis as unknown as RedisService,
  );
  return { service, repository, telegram };
}

describe('LoginCodeService', () => {
  it('stores only an HMAC of the code, bound to the request id', async () => {
    const t = codeService();
    await t.service.issue(request(), 42n, 'user-1');

    const saved = t.repository.update.mock.calls[0][1];
    const sentText: string = t.telegram.send.mock.calls[0][1];
    const code = /<code>(\d{6})<\/code>/.exec(sentText)?.[1] ?? '';

    expect(saved).toMatchObject({ status: 'CODE_SENT', userId: 'user-1', telegramId: 42n, codesSent: 1, attempts: 0 });
    expect(saved.codeHash).not.toContain(code);
    expect(t.service.matches(request({ codeHash: saved.codeHash }), code)).toBe(true);
    // The same code for a different request does not match.
    expect(t.service.matches(request({ id: '22222222-2222-2222-2222-222222222222', codeHash: saved.codeHash }), code)).toBe(false);
  });

  it('refuses to send more than the per-user limit in the window', async () => {
    const t = codeService(MAX_CODES_PER_WINDOW + 1);
    await expect(t.service.issue(request(), 42n, 'user-1')).resolves.toBe('RATE_LIMITED');
    expect(t.repository.update).not.toHaveBeenCalled();
  });

  it('marks an admin code as an admin code, never as the ordinary sign-in one', async () => {
    const t = codeService();
    await t.service.issue(request({ purpose: 'ADMIN' }), 42n, 'user-1');
    const sentText: string = t.telegram.send.mock.calls[0][1];
    expect(sentText).toContain('admin panel');
    expect(sentText).toContain('admin huquqi');
  });
});

function botService(adminIds = '') {
  const repository = {
    findAwaitingContact: jest.fn().mockResolvedValue(null),
    findByNonceHash: jest.fn(),
    transition: jest.fn().mockResolvedValue(true),
  };
  const codes = { issue: jest.fn() };
  const auth = {
    findUserByTelegramId: jest.fn().mockResolvedValue(null),
    touchTelegramProfile: jest.fn(),
    isPhoneTaken: jest.fn().mockResolvedValue(false),
    createTelegramUser: jest.fn().mockResolvedValue({ id: 'new-user' }),
  };
  const telegram = { send: jest.fn() };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn((key: string) => (key === 'ADMIN_TELEGRAM_IDS' ? adminIds : undefined)) };
  const service = new TelegramLoginBotService(
    repository as unknown as TelegramLoginRepository,
    codes as unknown as LoginCodeService,
    auth as unknown as AuthRepository,
    {} as SessionStateService,
    telegram as unknown as TelegramBotService,
    new AdminAccessService(config as unknown as ConfigService),
    audit as unknown as AdminAuditService,
  );
  return { service, repository, codes, auth, telegram, audit };
}

describe('TelegramLoginBotService admin sign-in', () => {
  const NONCE = 'abcdefghijklmnopqrstuvwxyz012345';

  it('sends an admin code to a registered account on the admin list', async () => {
    const t = botService('7001');
    t.repository.findByNonceHash.mockResolvedValue(request({ purpose: 'ADMIN' }));
    t.auth.findUserByTelegramId.mockResolvedValue({ id: 'owner' });

    await expect(t.service.handleStartPayload(`admin_${NONCE}`, { id: 7001, firstName: 'Ega' })).resolves.toBe(true);
    expect(t.codes.issue).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'ADMIN' }), 7001n, 'owner');
    expect(t.audit.record).not.toHaveBeenCalled();
  });

  it('answers anyone else like an expired link, cancels the request and records the attempt', async () => {
    const t = botService('7001');
    t.repository.findByNonceHash.mockResolvedValue(request({ purpose: 'ADMIN' }));
    t.auth.findUserByTelegramId.mockResolvedValue({ id: 'stranger' });

    await t.service.handleStartPayload(`admin_${NONCE}`, { id: 9009, firstName: 'Begona', username: 'begona' });

    expect(t.codes.issue).not.toHaveBeenCalled();
    expect(t.repository.transition).toHaveBeenCalledWith(request().id, ['PENDING'], 'CANCELLED');
    expect(t.telegram.send).toHaveBeenCalledWith(9009n, LOGIN_TEXT.expired, { html: true });
    expect(t.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_DENIED', telegramId: 9009n, meta: { reason: 'not_admin', username: 'begona' } }),
    );
  });

  it('refuses everyone when no admin is configured', async () => {
    const t = botService('');
    t.repository.findByNonceHash.mockResolvedValue(request({ purpose: 'ADMIN' }));
    t.auth.findUserByTelegramId.mockResolvedValue({ id: 'owner' });

    await t.service.handleStartPayload(`admin_${NONCE}`, { id: 7001, firstName: 'Ega' });
    expect(t.codes.issue).not.toHaveBeenCalled();
  });

  it('does not accept a user sign-in link under the admin prefix, or the other way round', async () => {
    const t = botService('7001');
    t.repository.findByNonceHash.mockResolvedValue(request({ purpose: 'LOGIN' }));
    t.auth.findUserByTelegramId.mockResolvedValue({ id: 'owner' });

    await t.service.handleStartPayload(`admin_${NONCE}`, { id: 7001, firstName: 'Ega' });
    expect(t.codes.issue).not.toHaveBeenCalled();
    expect(t.telegram.send).toHaveBeenCalledWith(7001n, LOGIN_TEXT.expired, { html: true });
  });
});

describe('TelegramLoginBotService.handleContact', () => {
  const setup = () => botService();

  it('ignores a contact card that belongs to someone else', async () => {
    const t = setup();
    await t.service.handleContact({ id: 1, firstName: 'Ali' }, { userId: 2, phoneNumber: '998901234567' });
    expect(t.auth.createTelegramUser).not.toHaveBeenCalled();
  });

  it('registers the sender with a normalised phone and sends the pending code', async () => {
    const t = setup();
    t.repository.findAwaitingContact.mockResolvedValue(request({ status: 'AWAITING_CONTACT', telegramId: 1n }));

    await t.service.handleContact(
      { id: 1, firstName: 'Ali', lastName: 'Valiyev', languageCode: 'ru' },
      { userId: 1, phoneNumber: '998 90 123-45-67' },
    );

    expect(t.auth.createTelegramUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ali Valiyev', telegramId: 1n, phone: '+998901234567', locale: 'ru' }),
    );
    expect(t.codes.issue).toHaveBeenCalledWith(expect.objectContaining({ status: 'AWAITING_CONTACT' }), 1n, 'new-user');
  });
});

describe('telegram login messages', () => {
  it('escapes user-controlled text for HTML parse mode', () => {
    expect(escapeHtml('<b>Ali & Vali</b>')).toBe('&lt;b&gt;Ali &amp; Vali&lt;/b&gt;');
  });

  it('describes a device from its User-Agent', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile')).toBe('Chrome, Android');
    expect(describeDevice(undefined)).toBe('noma’lum qurilma');
  });
});
