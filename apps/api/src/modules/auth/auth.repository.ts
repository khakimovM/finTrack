import { Injectable } from '@nestjs/common';
import { AccountType, CategoryType, Prisma, RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async createUserWithDefaults(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
        },
      });

      // 2. Create 10 default system categories (8 expense, 2 income)
      const defaultCategories: Prisma.CategoryCreateManyInput[] = [
        { userId: user.id, name: 'Oziq-ovqat', type: CategoryType.EXPENSE, icon: '🍔', color: '#ef4444', isSystem: true, sortOrder: 1 },
        { userId: user.id, name: 'Transport', type: CategoryType.EXPENSE, icon: '🚗', color: '#f97316', isSystem: true, sortOrder: 2 },
        { userId: user.id, name: 'Uy-joy', type: CategoryType.EXPENSE, icon: '🏠', color: '#84cc16', isSystem: true, sortOrder: 3 },
        { userId: user.id, name: 'Kommunal', type: CategoryType.EXPENSE, icon: '💡', color: '#eab308', isSystem: true, sortOrder: 4 },
        { userId: user.id, name: 'Kiyim', type: CategoryType.EXPENSE, icon: '👕', color: '#06b6d4', isSystem: true, sortOrder: 5 },
        { userId: user.id, name: 'Sog‘liq', type: CategoryType.EXPENSE, icon: '🏥', color: '#ec4899', isSystem: true, sortOrder: 6 },
        { userId: user.id, name: 'Ko‘ngilochar', type: CategoryType.EXPENSE, icon: '🎬', color: '#8b5cf6', isSystem: true, sortOrder: 7 },
        { userId: user.id, name: 'Taʼlim', type: CategoryType.EXPENSE, icon: '📚', color: '#3b82f6', isSystem: true, sortOrder: 8 },
        { userId: user.id, name: 'Oylik', type: CategoryType.INCOME, icon: '💼', color: '#10b981', isSystem: true, sortOrder: 9 },
        { userId: user.id, name: 'Qo‘shimcha daromad', type: CategoryType.INCOME, icon: '💵', color: '#14b8a6', isSystem: true, sortOrder: 10 },
      ];

      await tx.category.createMany({
        data: defaultCategories,
      });

      // 3. Create 1 default "Naqd pul" CASH account
      await tx.account.create({
        data: {
          userId: user.id,
          name: 'Naqd pul',
          type: AccountType.CASH,
          currency: 'UZS',
          isDefault: true,
          icon: '💵',
          color: '#10b981',
          openingBalance: BigInt(0),
          sortOrder: 1,
        },
      });

      return user;
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
    return this.prisma.refreshToken.create({
      data,
    });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  async revokeRefreshToken(id: string, replacedByHash?: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        replacedByHash,
      },
    });
  }

  async revokeTokenFamily(familyId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async getActiveSessions(userId: string): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
