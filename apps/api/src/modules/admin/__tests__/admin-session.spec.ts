import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAccessService, parseAdminIds } from '../core/admin-access.service';
import { ADMIN_IDLE_MS, ADMIN_SESSION_TTL_MS, AdminSessionService } from '../admin-session.service';
import { AdminGuard } from '../admin.guard';
import { AdminCookiesService } from '../admin-cookies.service';
import { AdminAuthService } from '../admin-auth.service';
import { AdminAuditService } from '../core/admin-audit.service';
import { TelegramLoginService } from '../../auth/telegram-login.service';
import { AuthRepository } from '../../auth/auth.repository';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';

const OWNER_TG = 7001n;
const T0 = new Date('2026-10-08T09:00:00Z');

function access(ids: string): AdminAccessService {
  return new AdminAccessService({ get: () => ids } as unknown as ConfigService);
}

/** An in-memory admin_sessions table and a clock the test moves by hand. */
function setup(ids = '7001') {
  const rows = new Map<string, Record<string, unknown>>();
  const user = { telegramId: OWNER_TG, deletedAt: null as Date | null };
  const prisma = {
    adminSession: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `s${rows.size + 1}`, revokedAt: null, ...data };
        rows.set(String(data.tokenHash), row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const row = rows.get(where.tokenHash);
        return row ? { ...row, user } : null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = [...rows.values()].find((r) => r.id === where.id);
        Object.assign(row ?? {}, data);
        return row;
      }),
    },
  };
  let now = T0;
  const clock = { now: () => now };
  const service = new AdminSessionService(
    prisma as unknown as PrismaService,
    access(ids),
    clock as unknown as ClockService,
  );
  return {
    service,
    prisma,
    user,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe('parseAdminIds', () => {
  it('reads a comma-separated list of Telegram ids, spaces allowed', () => {
    expect([...parseAdminIds('7001, 900000000001')]).toEqual([7001n, 900000000001n]);
    expect(parseAdminIds(undefined).size).toBe(0);
  });

  it('turns the panel off when the list is empty', () => {
    expect(access('').enabled).toBe(false);
    expect(access('').isAdmin(7001n)).toBe(false);
    expect(access('7001').isAdmin(null)).toBe(false);
  });
});

describe('AdminSessionService', () => {
  it('stores only a hash of the token and resolves the session back from the token', async () => {
    const t = setup();
    const { token, expiresAt } = await t.service.create('owner', { ipAddress: '1.2.3.4', userAgent: 'UA' });

    const stored = t.prisma.adminSession.create.mock.calls[0][0].data;
    expect(stored.tokenHash).not.toBe(token);
    expect(expiresAt.getTime() - T0.getTime()).toBe(ADMIN_SESSION_TTL_MS);
    await expect(t.service.resolve(token)).resolves.toMatchObject({ userId: 'owner' });
    await expect(t.service.resolve('not-a-token')).resolves.toBeNull();
    await expect(t.service.resolve(undefined)).resolves.toBeNull();
  });

  it('ends after an hour without a request', async () => {
    const t = setup();
    const { token } = await t.service.create('owner', {});
    t.advance(ADMIN_IDLE_MS - 1000);
    await expect(t.service.resolve(token)).resolves.not.toBeNull();
    // That request counted as activity: another 59 minutes are fine again.
    t.advance(ADMIN_IDLE_MS - 1000);
    await expect(t.service.resolve(token)).resolves.not.toBeNull();
    t.advance(ADMIN_IDLE_MS + 1000);
    await expect(t.service.resolve(token)).resolves.toBeNull();
  });

  it('ends eight hours after sign-in however busy the admin is', async () => {
    const t = setup();
    const { token } = await t.service.create('owner', {});
    for (let hour = 0; hour < 7; hour++) {
      t.advance(ADMIN_IDLE_MS - 60_000);
      await expect(t.service.resolve(token)).resolves.not.toBeNull();
    }
    t.advance(ADMIN_SESSION_TTL_MS - 7 * (ADMIN_IDLE_MS - 60_000));
    await expect(t.service.resolve(token)).resolves.toBeNull();
  });

  it('ends at once when the admin is taken off the list or the account is deleted', async () => {
    const off = setup('7001');
    const { token } = await off.service.create('owner', {});
    off.user.telegramId = 8002n;
    await expect(off.service.resolve(token)).resolves.toBeNull();

    const deleted = setup('7001');
    const second = await deleted.service.create('owner', {});
    deleted.user.deletedAt = T0;
    await expect(deleted.service.resolve(second.token)).resolves.toBeNull();
  });

  it('ends on logout and reports whose session it was', async () => {
    const t = setup();
    const { token } = await t.service.create('owner', {});
    await expect(t.service.revoke(token)).resolves.toEqual({ userId: 'owner' });
    await expect(t.service.resolve(token)).resolves.toBeNull();
    await expect(t.service.revoke(token)).resolves.toBeNull();
  });
});

describe('AdminAuthService without an admin configured', () => {
  it('answers every sign-in step with 404 and never opens a request', () => {
    const login = { start: jest.fn(), status: jest.fn(), resend: jest.fn(), redeem: jest.fn() };
    const service = new AdminAuthService(
      access(''),
      login as unknown as TelegramLoginService,
      {} as AdminSessionService,
      {} as AuthRepository,
      {} as AdminAuditService,
      {} as TelegramBotService,
      {} as ClockService,
    );
    const id = '11111111-1111-1111-1111-111111111111';
    expect(() => service.start({})).toThrow(NotFoundException);
    expect(() => service.status(id)).toThrow(NotFoundException);
    expect(() => service.resend(id)).toThrow(NotFoundException);
    return expect(service.verify({ requestId: id, code: '123456' }, {})).rejects.toBeInstanceOf(NotFoundException).then(() => {
      expect(login.start).not.toHaveBeenCalled();
      expect(login.redeem).not.toHaveBeenCalled();
    });
  });
});

describe('AdminGuard', () => {
  function context(cookies: Record<string, string>) {
    const request: Record<string, unknown> = { cookies };
    return {
      request,
      ctx: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext,
    };
  }
  const cookies = new AdminCookiesService({ get: () => undefined } as unknown as ConfigService);

  it('answers 404, like an unknown URL, without a live admin session', async () => {
    const t = setup();
    const guard = new AdminGuard(access('7001'), t.service, cookies);
    await expect(guard.canActivate(context({}).ctx)).rejects.toBeInstanceOf(NotFoundException);
    await expect(guard.canActivate(context({ ft_admin: 'forged' }).ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets a live admin session through and attaches the admin to the request', async () => {
    const t = setup();
    const { token } = await t.service.create('owner', {});
    const { ctx, request } = context({ ft_admin: token });
    await expect(new AdminGuard(access('7001'), t.service, cookies).canActivate(ctx)).resolves.toBe(true);
    expect(request.admin).toMatchObject({ userId: 'owner' });
  });

  it('answers 404 to everyone when no admin is configured', async () => {
    const t = setup('');
    const { token } = await t.service.create('owner', {});
    await expect(new AdminGuard(access(''), t.service, cookies).canActivate(context({ ft_admin: token }).ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
