import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADMIN_RETENTION_WEEKS,
  AdminFunnelResponse,
  AdminGrowthQuery,
  AdminGrowthResponse,
  AdminOverviewResponse,
  AdminPeriodQuery,
  AdminRetentionQuery,
  AdminRetentionResponse,
  AdminStatsGroupBy,
  AdminUsageResponse,
  addDays,
  endOfMonth,
  formatIsoDate,
  generateDateBuckets,
  parseIsoDate,
  startOfIsoWeek,
} from '@fintrack/shared';
import { ClockService } from '../../../infra/clock/clock.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { DailyMetricsService } from '../../activity/daily-metrics.service';
import { PROVIDER_FAILURES, PROVIDER_NAMES } from '../../assistant/assistant.types';
import { AdminStatsRepository, BucketRow } from './admin-stats.repository';

/** The panel shows numbers at most this old; heavy aggregates are not recomputed per click. */
export const ADMIN_STATS_CACHE_SECONDS = 60;
export const ADMIN_STATS_CACHE_PREFIX = 'admin:stats:';

const OUTCOMES = ['ok', 'limit', 'unavailable'] as const;

/** How long the counts of finished weeks and months are kept (they cannot change). */
const CLOSED_BUCKET_SECONDS = 7 * 24 * 3600;

const shift = (day: string, days: number) => formatIsoDate(addDays(parseIsoDate(day), days));
const toMap = (rows: BucketRow[]) => new Map(rows.map((r) => [r.bucket, r.n]));

/** Last day of the bucket starting on `bucket`. */
function bucketEnd(bucket: string, groupBy: AdminStatsGroupBy): string {
  if (groupBy === 'day') return bucket;
  if (groupBy === 'week') return shift(bucket, 6);
  return formatIsoDate(endOfMonth(parseIsoDate(bucket)));
}

/** Consecutive stretches of the buckets that match `want`, in order. */
function runs(buckets: string[], want: (bucket: string) => boolean): string[][] {
  const out: string[][] = [];
  let current: string[] = [];
  for (const bucket of buckets) {
    if (want(bucket)) {
      current.push(bucket);
    } else if (current.length > 0) {
      out.push(current);
      current = [];
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** Counts for the admin panel (docs/09, J3). Read-only, cached for a minute. */
@Injectable()
export class AdminStatsService {
  private readonly timeZone: string;

  constructor(
    private readonly repository: AdminStatsRepository,
    private readonly clock: ClockService,
    private readonly redis: RedisService,
    private readonly metrics: DailyMetricsService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Tashkent';
  }

  overview(): Promise<AdminOverviewResponse> {
    const today = this.today();
    return this.cached(`overview:${today}`, async () => {
      const [users, active, entries] = await Promise.all([
        this.repository.userCounts(today, this.timeZone),
        this.repository.activeCounts(today),
        this.repository.entryCounts(today, this.timeZone),
      ]);
      return {
        today,
        users: {
          total: users.total,
          newToday: users.newToday,
          new7d: { current: users.new7, previous: users.new7Prev },
          new30d: { current: users.new30, previous: users.new30Prev },
          activeToday: active.today,
          active7d: { current: active.d7, previous: active.d7Prev },
          active30d: { current: active.d30, previous: active.d30Prev },
          botBlocked: users.botBlocked,
          banned: users.banned,
          deleted: users.deleted,
        },
        entries: { total: entries.total, today: entries.today, last7d: { current: entries.d7, previous: entries.d7Prev } },
      };
    });
  }

  growth(query: AdminGrowthQuery): Promise<AdminGrowthResponse> {
    const { from, to, groupBy } = query;
    return this.cached(`growth:${from}:${to}:${groupBy}`, async () => {
      const [before, joined, activeBy, entries] = await Promise.all([
        this.repository.usersRegisteredBefore(from, this.timeZone),
        this.repository.newUsersByBucket(from, to, groupBy, this.timeZone),
        this.activeUsersByBucket(from, to, groupBy),
        this.repository.entriesByBucket(from, to, groupBy, this.timeZone),
      ]);
      const [joinedBy, entriesBy] = [toMap(joined), toMap(entries)];
      let registered = before;
      const points = generateDateBuckets(from, to, groupBy).map((bucket) => {
        const newUsers = joinedBy.get(bucket) ?? 0;
        registered += newUsers;
        return {
          bucket,
          newUsers,
          registeredUsers: registered,
          activeUsers: activeBy.get(bucket) ?? 0,
          entries: entriesBy.get(bucket) ?? 0,
        };
      });
      return { groupBy, points };
    });
  }

  retention(query: AdminRetentionQuery): Promise<AdminRetentionResponse> {
    const thisWeek = formatIsoDate(startOfIsoWeek(parseIsoDate(this.today())));
    const firstWeek = shift(thisWeek, -7 * (query.cohorts - 1));
    return this.cached(`retention:${thisWeek}:${query.cohorts}`, async () => {
      const [sizes, activity] = await Promise.all([
        this.repository.cohortSizes(firstWeek, this.timeZone),
        this.repository.cohortActivity(firstWeek, this.timeZone, ADMIN_RETENTION_WEEKS),
      ]);
      const sizeBy = toMap(sizes);
      const activeBy = new Map(activity.map((r) => [`${r.week}:${r.n}`, r.users]));
      const cohorts = generateDateBuckets(firstWeek, thisWeek, 'week').map((week) => ({
        week,
        size: sizeBy.get(week) ?? 0,
        active: Array.from({ length: ADMIN_RETENTION_WEEKS }, (_, n) =>
          shift(week, 7 * n) > thisWeek ? null : activeBy.get(`${week}:${n}`) ?? 0,
        ),
      }));
      return { weeks: ADMIN_RETENTION_WEEKS, cohorts };
    });
  }

  usage(query: AdminPeriodQuery): Promise<AdminUsageResponse> {
    const { from, to } = this.period(query);
    return this.cached(`usage:${from}:${to}`, async () => {
      const [channels, activeTotal, sources, features, assistant] = await Promise.all([
        this.repository.activeByChannel(from, to),
        this.repository.activeTotal(from, to),
        this.repository.entriesBySource(from, to, this.timeZone),
        this.repository.features(),
        this.assistantUsage(from, to),
      ]);
      const channel = (name: string) => channels.find((c) => c.channel === name)?.n ?? 0;
      const source = (name: string | null) => sources.find((s) => s.source === name)?.n ?? 0;
      return {
        from,
        to,
        activeUsers: {
          total: activeTotal,
          web: channel('WEB'),
          miniApp: channel('MINIAPP'),
          bot: channel('BOT'),
          unknown: channel('UNKNOWN'),
        },
        entries: {
          total: sources.reduce((sum, s) => sum + s.n, 0),
          web: source('WEB'),
          miniApp: source('MINIAPP'),
          bot: source('BOT'),
          voice: source('VOICE'),
          recurring: source('RECURRING'),
          unknown: source(null),
        },
        features,
        assistant,
      };
    });
  }

  funnel(query: AdminPeriodQuery): Promise<AdminFunnelResponse> {
    const { from, to } = this.period(query);
    return this.cached(`funnel:${from}:${to}`, async () => ({ from, to, ...(await this.repository.funnel(from, to, this.timeZone)) }));
  }

  /**
   * Distinct active users per bucket: the one aggregate that cannot be summed from days, and the
   * slowest (a year of weeks at 10 000 users is most of a second). A bucket that lies wholly
   * inside the range and ended before today no longer changes (short of an account being
   * purged), so it is kept for a week;
   * only the rest (a clipped first bucket, the current one, anything not seen yet) is queried,
   * one query per unbroken run of them.
   */
  private async activeUsersByBucket(from: string, to: string, groupBy: AdminStatsGroupBy): Promise<Map<string, number>> {
    const today = this.today();
    const cacheKey = `${ADMIN_STATS_CACHE_PREFIX}closed-active:${groupBy}`;
    const buckets = generateDateBuckets(from, to, groupBy);
    const closed = new Set(buckets.filter((b) => b >= from && bucketEnd(b, groupBy) <= to && bucketEnd(b, groupBy) < today));
    const kept = await this.redis.hashGetAll(cacheKey);
    const result = new Map<string, number>();
    for (const bucket of closed) if (kept[bucket] !== undefined) result.set(bucket, Number(kept[bucket]));

    const fresh: Record<string, string> = {};
    for (const run of runs(buckets, (b) => !result.has(b))) {
      const runFrom = run[0] < from ? from : run[0];
      const runTo = bucketEnd(run[run.length - 1], groupBy) > to ? to : bucketEnd(run[run.length - 1], groupBy);
      const counts = toMap(await this.repository.activeUsersByBucket(runFrom, runTo, groupBy));
      for (const bucket of run) {
        const n = counts.get(bucket) ?? 0;
        result.set(bucket, n);
        if (closed.has(bucket)) fresh[bucket] = String(n);
      }
    }
    if (Object.keys(fresh).length > 0) await this.redis.hashSet(cacheKey, fresh, CLOSED_BUCKET_SECONDS);
    return result;
  }

  private async assistantUsage(from: string, to: string): Promise<AdminUsageResponse['assistant']> {
    const outcomeNames = (['voice', 'text'] as const).flatMap((kind) => OUTCOMES.map((o) => `ai.${kind}.${o}`));
    const providerNames = PROVIDER_NAMES.flatMap((p) => [`ai.provider.${p}.ok`, ...PROVIDER_FAILURES.map((f) => `ai.provider.${p}.fail.${f}`)]);
    const totals = await this.metrics.sum([...outcomeNames, ...providerNames], generateDateBuckets(from, to, 'day'));
    const outcomes = (kind: 'voice' | 'text') => ({
      ok: totals.get(`ai.${kind}.ok`) ?? 0,
      limit: totals.get(`ai.${kind}.limit`) ?? 0,
      unavailable: totals.get(`ai.${kind}.unavailable`) ?? 0,
    });
    return {
      voice: outcomes('voice'),
      text: outcomes('text'),
      providers: PROVIDER_NAMES.map((name) => {
        const failures = Object.fromEntries(PROVIDER_FAILURES.map((f) => [f, totals.get(`ai.provider.${name}.fail.${f}`) ?? 0]));
        return {
          name,
          ok: totals.get(`ai.provider.${name}.ok`) ?? 0,
          failed: Object.values(failures).reduce((sum, n) => sum + n, 0),
          failures,
        };
      }),
    };
  }

  /** The asked period, or the last 30 days (today included). */
  private period(query: AdminPeriodQuery): { from: string; to: string } {
    const to = query.to ?? this.today();
    return { from: query.from ?? shift(to, -29), to };
  }

  private today(): string {
    return this.clock.todayIn(this.timeZone);
  }

  private async cached<T>(key: string, build: () => Promise<T>): Promise<T> {
    const cacheKey = `${ADMIN_STATS_CACHE_PREFIX}${key}`;
    const hit = await this.redis.get(cacheKey);
    if (hit) return JSON.parse(hit) as T;
    const value = await build();
    await this.redis.set(cacheKey, JSON.stringify(value), ADMIN_STATS_CACHE_SECONDS);
    return value;
  }
}
