import { ConfigService } from '@nestjs/config';
import { TelegramLoginRequest } from '@prisma/client';
import { LoginCodeService, MAX_CODES_PER_WINDOW } from '../login-code.service';
import { TelegramLoginRepository } from '../telegram-login.repository';
import { TelegramLoginBotService } from '../telegram-login-bot.service';
import { AuthRepository } from '../auth.repository';
import { SessionStateService } from '../session-state.service';
import { describeDevice, escapeHtml } from '../telegram-login.messages';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { RedisService } from '../../../infra/redis/redis.service';

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
});

describe('TelegramLoginBotService.handleContact', () => {
  function setup() {
    const repository = { findAwaitingContact: jest.fn().mockResolvedValue(null) };
    const codes = { issue: jest.fn() };
    const auth = {
      findUserByTelegramId: jest.fn().mockResolvedValue(null),
      isPhoneTaken: jest.fn().mockResolvedValue(false),
      createTelegramUser: jest.fn().mockResolvedValue({ id: 'new-user' }),
    };
    const telegram = { send: jest.fn() };
    const service = new TelegramLoginBotService(
      repository as unknown as TelegramLoginRepository,
      codes as unknown as LoginCodeService,
      auth as unknown as AuthRepository,
      {} as SessionStateService,
      telegram as unknown as TelegramBotService,
    );
    return { service, repository, codes, auth };
  }

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
