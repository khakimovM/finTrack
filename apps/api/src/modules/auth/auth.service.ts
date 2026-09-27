import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as crypto from 'crypto';
import { UserResponse, SessionResponse } from '@fintrack/shared';
import { AuthRepository } from './auth.repository';
import { SessionStateService } from './session-state.service';
import { durationToMs } from '../../common/utils/duration';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';

/** Window in which a just-rotated refresh token is treated as a concurrent refresh, not theft. */
const REFRESH_GRACE_MS = 30_000;

export interface TokenMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
  /** Refresh-token family = one signed-in device. */
  sessionId: string;
  accessTokenExpiresIn: number;
}

/** Masks all but the operator code and the last four digits: +99890***4567. */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length <= 9) return phone;
  return `${phone.slice(0, 6)}***${phone.slice(-4)}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessions: SessionStateService,
  ) {}

  /** Starts a new session (device) for an already-verified user. */
  async issueSession(user: User, meta: TokenMeta): Promise<AuthResult> {
    return this.buildResult(user, crypto.randomUUID(), meta);
  }

  async refresh(rawRefreshToken: string | undefined, meta: TokenMeta): Promise<AuthResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Refresh token taqdim etilmadi' });
    }

    try {
      await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Refresh token yaroqsiz yoki muddati tugagan',
      });
    }

    const tokenRecord = await this.repository.findRefreshTokenByHash(this.hashToken(rawRefreshToken));
    if (!tokenRecord) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Refresh token topilmadi' });
    }

    if (tokenRecord.revokedAt !== null) {
      // Two tabs refreshing at once present the same token milliseconds apart. That is not
      // theft: the loser just retries with the cookie the winner already received.
      const sinceRevocation = Date.now() - tokenRecord.revokedAt.getTime();
      if (tokenRecord.replacedByHash && sinceRevocation < REFRESH_GRACE_MS) {
        throw this.refreshRaceError();
      }
      this.logger.warn(`Security alert: refresh token reuse for family ${tokenRecord.familyId}`);
      await this.repository.revokeTokenFamily(tokenRecord.familyId);
      await this.sessions.revokeSessions([tokenRecord.familyId]);
      throw new UnauthorizedException({
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Xavfsizlik buzilishi aniqlandi. Barcha sessiyalar bekor qilindi. Qaytadan kiring',
      });
    }

    if (tokenRecord.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sessiya muddati tugagan. Qaytadan kiring' });
    }

    const user = await this.repository.findUserById(tokenRecord.userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Foydalanuvchi topilmadi' });
    }

    // Rotate within the same family; only one concurrent rotation of this token may win.
    const result = await this.buildResult(user, tokenRecord.familyId, meta);
    const newHash = this.hashToken(result.refreshToken);
    if (!(await this.repository.revokeRefreshToken(tokenRecord.id, newHash))) {
      await this.repository.deleteRefreshTokenByHash(newHash);
      throw this.refreshRaceError();
    }
    return result;
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenRecord = await this.repository.findRefreshTokenByHash(this.hashToken(rawRefreshToken));
    if (tokenRecord && !tokenRecord.revokedAt) {
      await this.repository.revokeTokenFamily(tokenRecord.familyId);
      await this.sessions.revokeSessions([tokenRecord.familyId]);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    const families = await this.repository.revokeAllUserTokens(userId);
    await this.sessions.revokeSessions(families);
  }

  async getMe(userId: string): Promise<UserResponse> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundDomainException('Foydalanuvchi topilmadi');
    return this.toUserResponse(user);
  }

  /** One entry per signed-in device (refresh-token family). */
  async getSessions(userId: string, currentSessionId?: string): Promise<SessionResponse[]> {
    const tokens = await this.repository.getActiveTokens(userId);
    const latestByFamily = new Map<string, (typeof tokens)[number]>();
    for (const token of tokens) {
      if (!latestByFamily.has(token.familyId)) latestByFamily.set(token.familyId, token);
    }
    const startedAt = await this.repository.familyStartedAt([...latestByFamily.keys()]);

    return [...latestByFamily.values()].map((t) => ({
      id: t.familyId,
      userAgent: t.userAgent,
      ipAddress: t.ipAddress,
      createdAt: (startedAt.get(t.familyId) ?? t.createdAt).toISOString(),
      lastUsedAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
      isCurrent: t.familyId === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    if ((await this.repository.revokeUserFamily(userId, sessionId)) === 0) {
      throw new NotFoundDomainException('Sessiya topilmadi');
    }
    await this.sessions.revokeSessions([sessionId]);
  }

  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      telegramUsername: user.telegramUsername,
      telegramLinked: user.telegramId !== null,
      phone: maskPhone(user.phone),
      avatarUrl: user.avatarUrl,
      baseCurrency: user.baseCurrency,
      locale: user.locale,
      timezone: user.timezone,
      strictMode: user.strictMode,
      notifyTelegram: user.notifyTelegram,
      dailyDigest: user.dailyDigest,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async buildResult(user: User, familyId: string, meta: TokenMeta): Promise<AuthResult> {
    const accessTtl = this.configService.get<string>('ACCESS_TOKEN_TTL', '15m');
    const refreshTtl = this.configService.get<string>('REFRESH_TOKEN_TTL', '7d');

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, sid: familyId },
      { secret: this.configService.get<string>('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, familyId, jti: crypto.randomUUID() },
      { secret: this.configService.get<string>('JWT_REFRESH_SECRET'), expiresIn: refreshTtl },
    );

    await this.repository.createRefreshToken({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      familyId,
      userAgent: meta.userAgent?.slice(0, 300),
      ipAddress: meta.ipAddress,
      expiresAt: new Date(Date.now() + durationToMs(refreshTtl)),
    });

    return {
      user: this.toUserResponse(user),
      accessToken,
      refreshToken,
      sessionId: familyId,
      accessTokenExpiresIn: Math.floor(durationToMs(accessTtl) / 1000),
    };
  }

  private refreshRaceError(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'REFRESH_RACE',
      message: 'Sessiya boshqa oynada yangilandi. So‘rovni qayta yuboring',
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
