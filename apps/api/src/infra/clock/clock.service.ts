import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { todayInTimeZone } from '@fintrack/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FutureDateException } from '../../common/exceptions/domain.exception';

/**
 * Single source of "now" and "today". Calendar days are always resolved in the user's time zone
 * (default Asia/Tashkent) — the server clock runs in UTC, five hours behind the user's day.
 */
@Injectable()
export class ClockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  now(): Date {
    return new Date();
  }

  defaultTimeZone(): string {
    return this.config.get<string>('APP_TIMEZONE', 'Asia/Tashkent');
  }

  todayIn(timeZone: string): string {
    try {
      return todayInTimeZone(timeZone, this.now());
    } catch {
      return todayInTimeZone(this.defaultTimeZone(), this.now());
    }
  }

  async timeZoneFor(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { timezone: true },
    });
    return user?.timezone ?? this.defaultTimeZone();
  }

  async todayFor(userId: string): Promise<string> {
    return this.todayIn(await this.timeZoneFor(userId));
  }

  /** ISO `YYYY-MM-DD` strings compare correctly as plain strings. */
  async assertNotFuture(userId: string, isoDate: string): Promise<void> {
    const today = await this.todayFor(userId);
    if (isoDate > today) {
      throw new FutureDateException(undefined, { date: isoDate, today });
    }
  }
}
