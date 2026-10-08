import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityChannel } from '@prisma/client';
import { parseIsoDate } from '@fintrack/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { ClockService } from '../../infra/clock/clock.service';

/** `lastSeenAt` is written at most this often per user. */
const SEEN_EVERY_SECONDS = 5 * 60;
/** A day key outlives its day by a little, whatever the server's clock skew. */
const DAY_KEY_SECONDS = 26 * 3600;

/**
 * Records that people use FinTrack, for the admin panel's active users and cohorts: one
 * `UserActivityDay` row per user, day and channel, and a recent `lastSeenAt`. Redis keeps the
 * database writes to a handful per user per day however many requests they make. Never throws:
 * a request must not fail because its activity could not be recorded.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Tashkent';
  }

  async touch(userId: string, channel: ActivityChannel): Promise<void> {
    try {
      const day = this.clock.todayIn(this.timeZone);
      if (await this.redis.setIfAbsent(`activity:seen:${userId}`, '1', SEEN_EVERY_SECONDS)) {
        await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: this.clock.now() } });
      }
      if (await this.redis.setIfAbsent(`activity:day:${day}:${channel}:${userId}`, '1', DAY_KEY_SECONDS)) {
        await this.prisma.userActivityDay.upsert({
          where: { userId_day_channel: { userId, day: parseIsoDate(day), channel } },
          create: { userId, day: parseIsoDate(day), channel },
          update: {},
        });
      }
    } catch (err) {
      this.logger.warn(`Activity not recorded for ${userId}: ${String(err)}`);
    }
  }

  /** A bot update: the sender is looked up at most once per window, not on every message. */
  async touchTelegram(telegramId: bigint): Promise<void> {
    try {
      const day = this.clock.todayIn(this.timeZone);
      const key = `activity:tg:${day}:${telegramId}`;
      if (!(await this.redis.setIfAbsent(key, '1', SEEN_EVERY_SECONDS))) return;
      const user = await this.prisma.user.findUnique({ where: { telegramId }, select: { id: true, deletedAt: true } });
      if (user && !user.deletedAt) {
        await this.touch(user.id, 'BOT');
      } else {
        // Not registered (yet): the message that registers them must still count.
        await this.redis.del(key);
      }
    } catch (err) {
      this.logger.warn(`Bot activity not recorded: ${String(err)}`);
    }
  }
}
