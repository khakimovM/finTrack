import { Injectable } from '@nestjs/common';
import { Prisma, RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DEFAULT_ACCOUNT, DEFAULT_CATEGORIES } from './user-defaults';

export interface NewTelegramUser {
  name: string;
  telegramId: bigint;
  telegramUsername: string | null;
  phone: string | null;
  locale: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async findUserByTelegramId(telegramId: bigint): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { telegramId, deletedAt: null } });
  }

  async isPhoneTaken(phone: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { phone } })) > 0;
  }

  /** New account with the 10 default categories and the "Naqd pul" account, atomically. */
  async createTelegramUser(data: NewTelegramUser): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });

      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id, isSystem: true })),
      });
      await tx.account.create({
        data: { ...DEFAULT_ACCOUNT, userId: user.id, isDefault: true, openingBalance: 0n },
      });
      return user;
    });
  }

  /** Keeps the display handle fresh and clears a "blocked" flag once the user talks to the bot. */
  async touchTelegramProfile(userId: string, telegramUsername: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramUsername, telegramBlockedAt: null },
    });
  }

  async linkTelegram(userId: string, telegramId: bigint, telegramUsername: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramId, telegramUsername, telegramBlockedAt: null },
    });
  }

  async createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Compare-and-set revocation: only one of several concurrent refreshes of the same token can
   * win. Returns false when another request already rotated it.
   */
  async revokeRefreshToken(id: string, replacedByHash?: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), replacedByHash },
    });
    return result.count === 1;
  }

  async deleteRefreshTokenByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async revokeTokenFamily(familyId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeUserFamily(userId: string, familyId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /** Returns the families that were active, so their access tokens can be revoked too. */
  async revokeAllUserTokens(userId: string): Promise<string[]> {
    const active = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
      select: { familyId: true },
      distinct: ['familyId'],
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return active.map((t) => t.familyId);
  }

  /** 'missing' also covers a family whose first row is still being written by another request. */
  async familyStatus(userId: string, familyId: string): Promise<'active' | 'ended' | 'missing'> {
    const latest = await this.prisma.refreshToken.findFirst({
      where: { userId, familyId },
      orderBy: { createdAt: 'desc' },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!latest) return 'missing';
    return latest.revokedAt === null && latest.expiresAt.getTime() > Date.now() ? 'active' : 'ended';
  }

  /** Newest first; one live token per family is the family's current state. */
  async getActiveTokens(userId: string): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async familyStartedAt(familyIds: string[]): Promise<Map<string, Date>> {
    const groups = await this.prisma.refreshToken.groupBy({
      by: ['familyId'],
      where: { familyId: { in: familyIds } },
      _min: { createdAt: true },
    });
    return new Map(groups.map((g) => [g.familyId, g._min.createdAt ?? new Date(0)]));
  }
}
