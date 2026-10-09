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

  /** Each metric summed over `days` (YYYY-MM-DD); days past retention simply count zero. */
  async sum(metrics: string[], days: string[]): Promise<Map<string, number>> {
    const keys = metrics.flatMap((metric) => days.map((day) => `metrics:${day}:${metric}`));
    const values = await this.redis.getMany(keys);
    const totals = new Map<string, number>(metrics.map((m) => [m, 0]));
    keys.forEach((key, i) => {
      const metric = key.split(':').slice(2).join(':');
      totals.set(metric, (totals.get(metric) ?? 0) + Number(values[i] ?? 0));
    });
    return totals;
  }
}
