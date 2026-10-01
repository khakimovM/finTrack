import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken, User } from '@prisma/client';
import { AuthService, maskPhone } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { SessionStateService } from '../session-state.service';

const config = {
  get: jest.fn((key: string, fallback?: unknown) => {
    const values: Record<string, unknown> = {
      JWT_ACCESS_SECRET: 'test_access_secret_min_32_characters_here',
      JWT_REFRESH_SECRET: 'test_refresh_secret_min_32_characters_here',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
    };
    return values[key] ?? fallback;
  }),
};

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: null,
    passwordHash: null,
    telegramId: 123456789n,
    telegramUsername: 'aziz',
    phone: '+998901234567',
    notifyTelegram: true,
    dailyDigest: false,
    telegramBlockedAt: null,
    name: 'Aziz',
    avatarUrl: null,
    baseCurrency: 'UZS',
    locale: 'uz',
    timezone: 'Asia/Tashkent',
    strictMode: false,
    emailVerifiedAt: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

function token(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'tok-1',
    userId: 'user-1',
    tokenHash: 'hash',
    familyId: 'fam-1',
    userAgent: 'Mozilla/5.0 Chrome/120 Windows',
    ipAddress: '10.0.0.1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    replacedByHash: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function setup() {
  const repository = {
    findUserById: jest.fn().mockResolvedValue(user()),
    createRefreshToken: jest.fn().mockResolvedValue({}),
    findRefreshTokenByHash: jest.fn(),
    revokeRefreshToken: jest.fn().mockResolvedValue(true),
    deleteRefreshTokenByHash: jest.fn(),
    revokeTokenFamily: jest.fn(),
    revokeUserFamily: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    getActiveTokens: jest.fn(),
    familyStartedAt: jest.fn(),
  };
  const jwt = {
    signAsync: jest.fn(async (payload: object) => `signed-${JSON.stringify(payload)}`),
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1' }),
  };
  const sessions = { revokeSessions: jest.fn() };
  const service = new AuthService(
    repository as unknown as AuthRepository,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
    sessions as unknown as SessionStateService,
  );
  return { service, repository, jwt, sessions };
}

describe('AuthService', () => {
  describe('issueSession', () => {
    it('puts the session id into the access token and stores only a hash of the refresh token', async () => {
      const t = setup();
      const result = await t.service.issueSession(user(), { userAgent: 'ua', ipAddress: '1.2.3.4' });

      const accessPayload = t.jwt.signAsync.mock.calls[0][0];
      expect(accessPayload).toEqual({ sub: 'user-1', sid: result.sessionId });
      const stored = t.repository.createRefreshToken.mock.calls[0][0];
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
      expect(result.user).toMatchObject({ telegramLinked: true, phone: '+99890***4567' });
    });
  });

  describe('refresh', () => {
    it('revokes the whole family and its access tokens on reuse of an old token', async () => {
      const t = setup();
      t.repository.findRefreshTokenByHash.mockResolvedValue(
        token({ revokedAt: new Date(Date.now() - 5 * 60_000), replacedByHash: 'next' }),
      );

      await expect(t.service.refresh('old', {})).rejects.toMatchObject({
        response: { code: 'TOKEN_REUSE_DETECTED' },
      });
      expect(t.repository.revokeTokenFamily).toHaveBeenCalledWith('fam-1');
      expect(t.sessions.revokeSessions).toHaveBeenCalledWith(['fam-1']);
    });

    it('treats a token rotated seconds ago as a concurrent refresh, not theft', async () => {
      const t = setup();
      t.repository.findRefreshTokenByHash.mockResolvedValue(
        token({ revokedAt: new Date(Date.now() - 2_000), replacedByHash: 'next' }),
      );

      await expect(t.service.refresh('old', {})).rejects.toMatchObject({ response: { code: 'REFRESH_RACE' } });
      expect(t.repository.revokeTokenFamily).not.toHaveBeenCalled();
    });

    it('drops its freshly minted token when another request won the rotation', async () => {
      const t = setup();
      t.repository.findRefreshTokenByHash.mockResolvedValue(token());
      t.repository.revokeRefreshToken.mockResolvedValue(false);

      await expect(t.service.refresh('raw', {})).rejects.toMatchObject({ response: { code: 'REFRESH_RACE' } });
      expect(t.repository.deleteRefreshTokenByHash).toHaveBeenCalledWith(expect.any(String));
    });

    it('rejects an expired refresh token', async () => {
      const t = setup();
      t.repository.findRefreshTokenByHash.mockResolvedValue(token({ expiresAt: new Date(Date.now() - 1) }));
      await expect(t.service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
      expect(t.repository.createRefreshToken).not.toHaveBeenCalled();
    });

    it('rotates within the same family', async () => {
      const t = setup();
      t.repository.findRefreshTokenByHash.mockResolvedValue(token());

      const result = await t.service.refresh('raw', {});

      expect(result.sessionId).toBe('fam-1');
      expect(t.repository.revokeRefreshToken).toHaveBeenCalledWith('tok-1', expect.any(String));
    });

    it('rejects a request without a refresh cookie', async () => {
      const t = setup();
      await expect(t.service.refresh(undefined, {})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sessions', () => {
    it('logout-all revokes every family and blocks their access tokens', async () => {
      const t = setup();
      t.repository.revokeAllUserTokens.mockResolvedValue(['fam-1', 'fam-2']);
      await t.service.logoutAll('user-1');
      expect(t.sessions.revokeSessions).toHaveBeenCalledWith(['fam-1', 'fam-2']);
    });

    it('lists one entry per device and marks the current one', async () => {
      const t = setup();
      t.repository.getActiveTokens.mockResolvedValue([
        token({ id: 'a', familyId: 'fam-1', createdAt: new Date('2026-09-27T10:00:00Z') }),
        token({ id: 'b', familyId: 'fam-2', createdAt: new Date('2026-09-26T10:00:00Z') }),
        token({ id: 'c', familyId: 'fam-1', createdAt: new Date('2026-09-20T10:00:00Z') }),
      ]);
      t.repository.familyStartedAt.mockResolvedValue(
        new Map([
          ['fam-1', new Date('2026-09-01T00:00:00Z')],
          ['fam-2', new Date('2026-09-26T10:00:00Z')],
        ]),
      );

      const list = await t.service.getSessions('user-1', 'fam-1');

      expect(list).toHaveLength(2);
      expect(list[0]).toMatchObject({
        id: 'fam-1',
        isCurrent: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        lastUsedAt: '2026-09-27T10:00:00.000Z',
      });
      expect(list[1]).toMatchObject({ id: 'fam-2', isCurrent: false });
    });

    it('ending an unknown session is a 404', async () => {
      const t = setup();
      t.repository.revokeUserFamily.mockResolvedValue(0);
      await expect(t.service.revokeSession('user-1', 'fam-x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  it('maskPhone keeps the operator code and last four digits', () => {
    expect(maskPhone('+998901234567')).toBe('+99890***4567');
    expect(maskPhone(null)).toBeNull();
  });
});
