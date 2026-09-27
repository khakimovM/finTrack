import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface ProfileChanges {
  name?: string;
  locale?: string;
  timezone?: string;
  strictMode?: boolean;
  notifyTelegram?: boolean;
  dailyDigest?: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, data: ProfileChanges): Promise<User> {
    return this.prisma.user.update({ where: { id: userId, deletedAt: null }, data });
  }

  /**
   * Erases the account and everything in it. Ledger rows go first because transactions restrict
   * account deletion (a finance history must never lose its account by accident); every other
   * table cascades from the user row.
   */
  async deleteUserData(userId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 60_000 },
    );
  }
}
