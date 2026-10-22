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
  dailyReminders?: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Opted-in, reachable users for the evening digest. */
  async findDigestRecipients(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { dailyDigest: true, telegramId: { not: null }, telegramBlockedAt: null, deletedAt: null },
    });
  }

  /**
   * Reachable users who keep the bot reminders on. With `quietOn`, only those with no activity on
   * any channel that day, and not those whose evening digest already says the day was empty.
   */
  async findReminderRecipients(quietOn?: Date): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        dailyReminders: true,
        telegramId: { not: null },
        telegramBlockedAt: null,
        bannedAt: null,
        deletedAt: null,
        ...(quietOn ? { dailyDigest: false, activityDays: { none: { day: quietOn } } } : {}),
      },
    });
  }

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
