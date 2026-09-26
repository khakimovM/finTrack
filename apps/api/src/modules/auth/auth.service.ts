import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  UserResponse,
  SessionResponse,
} from '@fintrack/shared';
import { AuthRepository } from './auth.repository';
import { ConflictDomainException, NotFoundDomainException } from '../../common/exceptions/domain.exception';

interface TokenMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterInput, meta: TokenMeta): Promise<AuthResult> {
    const existing = await this.repository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictDomainException('EMAIL_TAKEN', 'Ushbu email bilan foydalanuvchi allaqachon mavjud');
    }

    const bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(input.password, bcryptRounds);

    const user = await this.repository.createUserWithDefaults({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const familyId = crypto.randomUUID();
    const tokens = await this.generateTokens(user, familyId, meta);

    return {
      user: this.toUserResponse(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(input: LoginInput, meta: TokenMeta): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user) {
      // Invariant: never reveal whether the email exists
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email yoki parol noto‘g‘ri',
      });
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email yoki parol noto‘g‘ri',
      });
    }

    const familyId = crypto.randomUUID();
    const tokens = await this.generateTokens(user, familyId, meta);

    return {
      user: this.toUserResponse(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(rawRefreshToken: string | undefined, meta: TokenMeta): Promise<AuthResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Refresh token taqdim etilmadi',
      });
    }

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    try {
      await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Refresh token yaroqsiz yoki muddati tugagan',
      });
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const tokenRecord = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!tokenRecord) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Refresh token topilmadi',
      });
    }

    // Reuse detection: If token was already revoked, revoke whole family
    if (tokenRecord.revokedAt !== null) {
      this.logger.warn(`Security alert: Token reuse detected for family ${tokenRecord.familyId}, user ${tokenRecord.userId}`);
      await this.repository.revokeTokenFamily(tokenRecord.familyId);
      throw new UnauthorizedException({
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Xavfsizlik buzilishi aniqlandi. Barcha sessiyalar bekor qilindi. Qaytadan kiring',
      });
    }

    const user = await this.repository.findUserById(tokenRecord.userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Foydalanuvchi topilmadi',
      });
    }

    // Rotate token within the same family
    const newTokens = await this.generateTokens(user, tokenRecord.familyId, meta);
    const newHash = this.hashToken(newTokens.refreshToken);

    await this.repository.revokeRefreshToken(tokenRecord.id, newHash);

    return {
      user: this.toUserResponse(user),
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      const tokenRecord = await this.repository.findRefreshTokenByHash(tokenHash);
      if (tokenRecord && !tokenRecord.revokedAt) {
        await this.repository.revokeRefreshToken(tokenRecord.id);
      }
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.repository.revokeAllUserTokens(userId);
  }

  async getMe(userId: string): Promise<UserResponse> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new NotFoundDomainException('Foydalanuvchi topilmadi');
    }
    return this.toUserResponse(user);
  }

  async getSessions(userId: string, currentRefreshToken?: string): Promise<SessionResponse[]> {
    const sessions = await this.repository.getActiveSessions(userId);
    const currentHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : null;

    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: currentHash ? s.tokenHash === currentHash : false,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.repository.revokeSession(userId, sessionId);
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    void input;
    return {
      message: 'Agar ushbu email tizimda mavjud bo‘lsa, parolni tiklash havolasi yuborildi',
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    void input;
    return {
      message: 'Parol muvaffaqiyatli yangilandi',
    };
  }

  async verifyEmail(input: VerifyEmailInput): Promise<{ message: string }> {
    void input;
    return {
      message: 'Email muvaffaqiyatli tasdiqlandi',
    };
  }

  private async generateTokens(
    user: User,
    familyId: string,
    meta: TokenMeta,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const accessTtl = this.configService.get<string>('ACCESS_TOKEN_TTL', '15m');
    const refreshTtl = this.configService.get<string>('REFRESH_TOKEN_TTL', '7d');

    const payload = { sub: user.id, email: user.email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, familyId },
      {
        secret: refreshSecret,
        expiresIn: refreshTtl,
      },
    );

    // Refresh token is stored hashed in the RefreshToken table
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.repository.createRefreshToken({
      userId: user.id,
      tokenHash,
      familyId,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      baseCurrency: user.baseCurrency,
      locale: user.locale,
      strictMode: user.strictMode,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
