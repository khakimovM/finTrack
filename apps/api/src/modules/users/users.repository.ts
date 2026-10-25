import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { endOfMonth, parseIsoDate, startOfMonth } from '@fintrack/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface ProfileChanges {
  name?: string;
  locale?: string;
  timezone?: string;
  strictMode?: boolean;
  notifyTelegram?: boolean;
  dailyDigest?: boolean;
  dailyReminders?: boolean;
  monthlyReport?: boolean;
}

/** A month as two days, both included. */
export interface MonthRange {
  from: Date;
  to: Date;
}

/** The calendar month a `YYYY-MM-DD` day falls in. */
export function monthOf(day: string): MonthRange {
  const date = parseIsoDate(day);
  return { from: startOfMonth(date), to: endOfMonth(date) };
}

/** Kept the report on and recorded income or an expense that month: there is something to report. */
function getsMonthlyReport(month: MonthRange): Prisma.UserWhereInput {
  return {
    monthlyReport: true,
    bannedAt: null,
    transactions: {
      some: { type: { in: ['INCOME', 'EXPENSE'] }, deletedAt: null, date: { gte: month.from, lte: month.to } },
    },
  };
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Opted-in, reachable users for the evening digest. On the month's last day, `instead` leaves out
   * those whose monthly report goes at the same hour, so nobody gets two summaries at once.
   */
  async findDigestRecipients(instead?: MonthRange): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        dailyDigest: true,
        telegramId: { not: null },
        telegramBlockedAt: null,
        deletedAt: null,
        ...(instead ? { NOT: getsMonthlyReport(instead) } : {}),
      },
    });
  }

  /** Reachable users who get the month's report. */
  async findMonthlyRecipients(month: MonthRange): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { telegramId: { not: null }, telegramBlockedAt: null, deletedAt: null, ...getsMonthlyReport(month) },
      orderBy: { createdAt: 'asc' },
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
