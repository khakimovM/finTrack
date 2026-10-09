import { ConfigService } from '@nestjs/config';
import { AdminStatsService } from '../admin-stats.service';
import { AdminStatsRepository, BucketRow } from '../admin-stats.repository';
import { ClockService } from '../../../../infra/clock/clock.service';
import { RedisService } from '../../../../infra/redis/redis.service';
import { DailyMetricsService } from '../../../activity/daily-metrics.service';

/** Mondays from 2026-09-07; "today" is Thursday 2026-10-08, so the week of 2026-10-05 is still open. */
const TODAY = '2026-10-08';

function setup() {
  const hashes = new Map<string, Record<string, string>>();
  const redis = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => 'OK'),
    hashGetAll: jest.fn(async (key: string) => ({ ...(hashes.get(key) ?? {}) })),
    hashSet: jest.fn(async (key: string, fields: Record<string, string>) => {
      hashes.set(key, { ...(hashes.get(key) ?? {}), ...fields });
    }),
  };
  // Every week had 10 active users, and a day of a week counts one.
  const activeUsersByBucket = jest.fn(async (from: string, to: string, groupBy: string): Promise<BucketRow[]> => {
    const weeks = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'];
    const inRange = weeks.filter((w) => w >= mondayOf(from) && w <= to);
    return inRange.map((bucket) => ({ bucket, n: groupBy === 'week' ? 10 : 1 }));
  });
  const repository = {
    usersRegisteredBefore: jest.fn(async () => 0),
    newUsersByBucket: jest.fn(async () => []),
    entriesByBucket: jest.fn(async () => []),
    activeUsersByBucket,
  };
  const service = new AdminStatsService(
    repository as unknown as AdminStatsRepository,
    { todayIn: () => TODAY } as unknown as ClockService,
    redis as unknown as RedisService,
    {} as DailyMetricsService,
    { get: () => 'Asia/Tashkent' } as unknown as ConfigService,
  );
  return { service, activeUsersByBucket, hashes };
}

function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

describe('AdminStatsService: active users per finished bucket', () => {
  it('queries the clipped first week, the finished ones and the open one, and keeps only the finished', async () => {
    const { service, activeUsersByBucket, hashes } = setup();
    const res = await service.growth({ from: '2026-09-03', to: TODAY, groupBy: 'week' });

    expect(res.points.map((p) => p.activeUsers)).toEqual([10, 10, 10, 10, 10, 10]);
    expect(activeUsersByBucket).toHaveBeenCalledTimes(1);
    expect(activeUsersByBucket).toHaveBeenCalledWith('2026-09-03', TODAY, 'week');
    // 2026-08-31 starts before the range and 2026-10-05 has not ended: neither is kept.
    expect(Object.keys(hashes.get('admin:stats:closed-active:week') ?? {})).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('afterwards asks the database only for the weeks it does not keep, one query per gap', async () => {
    const { service, activeUsersByBucket } = setup();
    await service.growth({ from: '2026-09-03', to: TODAY, groupBy: 'week' });
    activeUsersByBucket.mockClear();

    const res = await service.growth({ from: '2026-09-03', to: TODAY, groupBy: 'week' });

    expect(res.points.map((p) => p.activeUsers)).toEqual([10, 10, 10, 10, 10, 10]);
    expect(activeUsersByBucket.mock.calls).toEqual([
      ['2026-09-03', '2026-09-06', 'week'],
      ['2026-10-05', TODAY, 'week'],
    ]);
  });

  it('does not keep a week cut short by the end of the range', async () => {
    const { service, hashes } = setup();
    await service.growth({ from: '2026-09-07', to: '2026-09-16', groupBy: 'week' });
    expect(Object.keys(hashes.get('admin:stats:closed-active:week') ?? {})).toEqual(['2026-09-07']);
  });
});
