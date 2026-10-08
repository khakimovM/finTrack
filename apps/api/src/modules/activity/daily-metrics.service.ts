import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../infra/redis/redis.service';
import { ClockService } from '../../infra/clock/clock.service';

/** The admin panel looks back at most this far. */
export const METRICS_RETENTION_SECONDS = 120 * 24 * 3600;

/**
 * Daily counters for things the database does not record, such as AI assistant calls:
 * `metrics:<YYYY-MM-DD>:<metric>` in Redis, kept for 120 days. A lost increment is acceptable;
 * a failing request because of one is not, so nothing here throws.
 */
@Injectable()
export class DailyMetricsService {
  private readonly timeZone: string;

  constructor(
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Tashkent';
  }

  async increment(metric: string): Promise<void> {
    const day = this.clock.todayIn(this.timeZone);
    await this.redis.incrWithTtl(`metrics:${day}:${metric}`, METRICS_RETENTION_SECONDS);
  }
}
