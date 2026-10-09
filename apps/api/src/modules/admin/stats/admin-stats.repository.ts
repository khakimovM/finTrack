import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminStatsGroupBy, addDays, formatIsoDate, parseIsoDate } from '@fintrack/shared';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ENTRY } from '../core/admin-sql';

/**
 * The admin panel's reads across all users: the one deliberate exception to "every query is
 * scoped to the owner" (docs/09). Every query here returns counts and dates, never an amount,
 * a balance, a name or a note; test/admin-stats.e2e-spec.ts walks every answer to hold that line.
 *
 * Timestamps are stored as UTC wall time; calendar days are those of `tz` (Asia/Tashkent).
 */

/** Local midnight of `day` in `tz`, as the UTC wall time `created_at` columns hold. */
function midnight(day: string, tz: string): Prisma.Sql {
  return Prisma.sql`((${day}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
}

/** The local calendar day of a `created_at` column. */
function localDay(column: Prisma.Sql, tz: string): Prisma.Sql {
  return Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
}

const shift = (day: string, days: number) => formatIsoDate(addDays(parseIsoDate(day), days));

export interface UserCountsRow {
  total: number;
  newToday: number;
  new7: number;
  new7Prev: number;
  new30: number;
  new30Prev: number;
  botBlocked: number;
  banned: number;
  deleted: number;
}

export interface ActiveCountsRow {
  today: number;
  d7: number;
  d7Prev: number;
  d30: number;
  d30Prev: number;
}

export interface EntryCountsRow {
  total: number;
  today: number;
  d7: number;
  d7Prev: number;
}

export interface BucketRow {
  bucket: string;
  n: number;
}

export interface CohortRow {
  week: string;
  n: number;
  users: number;
}

export interface FeatureRow {
  users: number;
  withDebt: number;
  withBudget: number;
  withRecurring: number;
  withTag: number;
  withSeveralAccounts: number;
  withOwnCategory: number;
  strictMode: number;
  dailyDigest: number;
  telegramNotifications: number;
}

export interface FunnelRow {
  registered: number;
  firstEntry: number;
  fiveEntries: number;
  returnedWeek2: number;
}

@Injectable()
export class AdminStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Each query in its own short transaction with room to hash and sort in memory: at 500 000
   * entries the default work_mem spills these aggregates to disk and takes seconds.
   */
  private run<T>(query: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SET LOCAL work_mem = '64MB'`;
      return query(db);
    });
  }

  /** Windows end today: "7 days" is today and the six days before it. */
  async userCounts(today: string, tz: string): Promise<UserCountsRow> {
    const [row] = await this.run((db) => db.$queryRaw<UserCountsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE "deleted_at" IS NULL)::int AS "total",
        COUNT(*) FILTER (WHERE "created_at" >= ${midnight(today, tz)})::int AS "newToday",
        COUNT(*) FILTER (WHERE "created_at" >= ${midnight(shift(today, -6), tz)})::int AS "new7",
        COUNT(*) FILTER (WHERE "created_at" >= ${midnight(shift(today, -13), tz)}
                           AND "created_at" < ${midnight(shift(today, -6), tz)})::int AS "new7Prev",
        COUNT(*) FILTER (WHERE "created_at" >= ${midnight(shift(today, -29), tz)})::int AS "new30",
        COUNT(*) FILTER (WHERE "created_at" >= ${midnight(shift(today, -59), tz)}
                           AND "created_at" < ${midnight(shift(today, -29), tz)})::int AS "new30Prev",
        COUNT(*) FILTER (WHERE "telegram_blocked_at" IS NOT NULL AND "deleted_at" IS NULL)::int AS "botBlocked",
        COUNT(*) FILTER (WHERE "banned_at" IS NOT NULL AND "deleted_at" IS NULL)::int AS "banned",
        COUNT(*) FILTER (WHERE "deleted_at" IS NOT NULL)::int AS "deleted"
      FROM "users"
    `);
    return row;
  }

  async activeCounts(today: string): Promise<ActiveCountsRow> {
    const [row] = await this.run((db) => db.$queryRaw<ActiveCountsRow[]>`
      SELECT
        COUNT(DISTINCT "user_id") FILTER (WHERE "day" = ${today}::date)::int AS "today",
        COUNT(DISTINCT "user_id") FILTER (WHERE "day" >= ${shift(today, -6)}::date)::int AS "d7",
        COUNT(DISTINCT "user_id") FILTER (WHERE "day" BETWEEN ${shift(today, -13)}::date AND ${shift(today, -7)}::date)::int AS "d7Prev",
        COUNT(DISTINCT "user_id") FILTER (WHERE "day" >= ${shift(today, -29)}::date)::int AS "d30",
        COUNT(DISTINCT "user_id") FILTER (WHERE "day" BETWEEN ${shift(today, -59)}::date AND ${shift(today, -30)}::date)::int AS "d30Prev"
      FROM "user_activity_days"
      WHERE "day" >= ${shift(today, -59)}::date
    `);
    return row;
  }

  async entryCounts(today: string, tz: string): Promise<EntryCountsRow> {
    const [row] = await this.run((db) => db.$queryRaw<EntryCountsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE t."deleted_at" IS NULL)::int AS "total",
        COUNT(*) FILTER (WHERE t."created_at" >= ${midnight(today, tz)})::int AS "today",
        COUNT(*) FILTER (WHERE t."created_at" >= ${midnight(shift(today, -6), tz)})::int AS "d7",
        COUNT(*) FILTER (WHERE t."created_at" >= ${midnight(shift(today, -13), tz)}
                           AND t."created_at" < ${midnight(shift(today, -6), tz)})::int AS "d7Prev"
      FROM "transactions" t
      WHERE ${ENTRY}
    `);
    return row;
  }

  async usersRegisteredBefore(day: string, tz: string): Promise<number> {
    const [row] = await this.run((db) => db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS "n" FROM "users" WHERE "created_at" < ${midnight(day, tz)}
    `);
    return row.n;
  }

  async newUsersByBucket(from: string, to: string, groupBy: AdminStatsGroupBy, tz: string): Promise<BucketRow[]> {
    return this.run((db) => db.$queryRaw<BucketRow[]>`
      SELECT to_char(date_trunc(${groupBy}::text, ${localDay(Prisma.sql`"created_at"`, tz)}), 'YYYY-MM-DD') AS "bucket",
             COUNT(*)::int AS "n"
      FROM "users"
      WHERE "created_at" >= ${midnight(from, tz)} AND "created_at" < ${midnight(shift(to, 1), tz)}
      GROUP BY 1
    `);
  }

  async activeUsersByBucket(from: string, to: string, groupBy: AdminStatsGroupBy): Promise<BucketRow[]> {
    // DISTINCT first, then COUNT: Postgres can hash the pairs, while COUNT(DISTINCT) always sorts
    // every row of the range (four times slower on a year of weeks).
    return this.run((db) => db.$queryRaw<BucketRow[]>`
      SELECT to_char("b", 'YYYY-MM-DD') AS "bucket", COUNT(*)::int AS "n"
      FROM (
        SELECT DISTINCT date_trunc(${groupBy}::text, "day"::timestamp) AS "b", "user_id"
        FROM "user_activity_days"
        WHERE "day" BETWEEN ${from}::date AND ${to}::date
      ) AS pairs
      GROUP BY "b"
    `);
  }

  async entriesByBucket(from: string, to: string, groupBy: AdminStatsGroupBy, tz: string): Promise<BucketRow[]> {
    return this.run((db) => db.$queryRaw<BucketRow[]>`
      SELECT to_char(date_trunc(${groupBy}::text, ${localDay(Prisma.sql`t."created_at"`, tz)}), 'YYYY-MM-DD') AS "bucket",
             COUNT(*)::int AS "n"
      FROM "transactions" t
      WHERE ${ENTRY} AND t."created_at" >= ${midnight(from, tz)} AND t."created_at" < ${midnight(shift(to, 1), tz)}
      GROUP BY 1
    `);
  }

  /** Sign-ups per week from `firstWeek` (a Monday). */
  async cohortSizes(firstWeek: string, tz: string): Promise<BucketRow[]> {
    return this.run((db) => db.$queryRaw<BucketRow[]>`
      SELECT to_char(date_trunc('week', ${localDay(Prisma.sql`"created_at"`, tz)}), 'YYYY-MM-DD') AS "bucket",
             COUNT(*)::int AS "n"
      FROM "users"
      WHERE "created_at" >= ${midnight(firstWeek, tz)}
      GROUP BY 1
    `);
  }

  /** For each sign-up week and each week n after it (0–8): how many of its users were active. */
  async cohortActivity(firstWeek: string, tz: string, weeks: number): Promise<CohortRow[]> {
    return this.run((db) => db.$queryRaw<CohortRow[]>`
      WITH cohort AS (
        SELECT "id" AS "user_id", date_trunc('week', ${localDay(Prisma.sql`"created_at"`, tz)})::date AS "week"
        FROM "users"
        WHERE "created_at" >= ${midnight(firstWeek, tz)}
      )
      SELECT to_char(c."week", 'YYYY-MM-DD') AS "week",
             ((a."day" - c."week") / 7)::int AS "n",
             COUNT(DISTINCT c."user_id")::int AS "users"
      FROM cohort c
      JOIN "user_activity_days" a ON a."user_id" = c."user_id"
      WHERE a."day" >= c."week" AND a."day" < c."week" + ${weeks * 7}::int
      GROUP BY 1, 2
    `);
  }

  async activeByChannel(from: string, to: string): Promise<{ channel: string; n: number }[]> {
    return this.run((db) => db.$queryRaw<{ channel: string; n: number }[]>`
      SELECT "channel"::text AS "channel", COUNT(DISTINCT "user_id")::int AS "n"
      FROM "user_activity_days"
      WHERE "day" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
    `);
  }

  async activeTotal(from: string, to: string): Promise<number> {
    const [row] = await this.run((db) => db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(DISTINCT "user_id")::int AS "n"
      FROM "user_activity_days"
      WHERE "day" BETWEEN ${from}::date AND ${to}::date
    `);
    return row.n;
  }

  async entriesBySource(from: string, to: string, tz: string): Promise<{ source: string | null; n: number }[]> {
    return this.run((db) => db.$queryRaw<{ source: string | null; n: number }[]>`
      SELECT t."source"::text AS "source", COUNT(*)::int AS "n"
      FROM "transactions" t
      WHERE ${ENTRY} AND t."created_at" >= ${midnight(from, tz)} AND t."created_at" < ${midnight(shift(to, 1), tz)}
      GROUP BY 1
    `);
  }

  /**
   * Current users and the features they use right now. Sign-up creates ten categories, so an
   * "own" category is one made later than that (over a minute after registering).
   */
  async features(): Promise<FeatureRow> {
    const [row] = await this.run((db) => db.$queryRaw<FeatureRow[]>`
      SELECT
        COUNT(*)::int AS "users",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "debts" d WHERE d."user_id" = u."id" AND d."deleted_at" IS NULL))::int AS "withDebt",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "budgets" b WHERE b."user_id" = u."id"))::int AS "withBudget",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "recurring_rules" r WHERE r."user_id" = u."id" AND r."is_active"))::int AS "withRecurring",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "tags" g WHERE g."user_id" = u."id"))::int AS "withTag",
        COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM "accounts" a
                                WHERE a."user_id" = u."id" AND a."deleted_at" IS NULL AND a."archived_at" IS NULL) >= 2)::int AS "withSeveralAccounts",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "categories" c
                                       WHERE c."user_id" = u."id" AND c."deleted_at" IS NULL AND NOT c."is_system"
                                         AND c."created_at" > u."created_at" + interval '1 minute'))::int AS "withOwnCategory",
        COUNT(*) FILTER (WHERE u."strict_mode")::int AS "strictMode",
        COUNT(*) FILTER (WHERE u."daily_digest")::int AS "dailyDigest",
        COUNT(*) FILTER (WHERE u."notify_telegram" AND u."telegram_blocked_at" IS NULL)::int AS "telegramNotifications"
      FROM "users" u
      WHERE u."deleted_at" IS NULL
    `);
    return row;
  }

  /** People who signed up between `from` and `to`: how many made an entry, five, came back. */
  async funnel(from: string, to: string, tz: string): Promise<FunnelRow> {
    const [row] = await this.run((db) => db.$queryRaw<FunnelRow[]>`
      WITH cohort AS (
        SELECT "id", ${localDay(Prisma.sql`"created_at"`, tz)}::date AS "joined"
        FROM "users"
        WHERE "created_at" >= ${midnight(from, tz)} AND "created_at" < ${midnight(shift(to, 1), tz)}
      ),
      made AS (
        SELECT t."user_id", COUNT(*)::int AS "n"
        FROM "transactions" t
        JOIN cohort c ON c."id" = t."user_id"
        WHERE ${ENTRY} AND t."recurring_rule_id" IS NULL
        GROUP BY t."user_id"
      )
      SELECT
        (SELECT COUNT(*) FROM cohort)::int AS "registered",
        (SELECT COUNT(*) FROM made WHERE "n" >= 1)::int AS "firstEntry",
        (SELECT COUNT(*) FROM made WHERE "n" >= 5)::int AS "fiveEntries",
        (SELECT COUNT(*) FROM cohort c WHERE EXISTS (
          SELECT 1 FROM "user_activity_days" a
          WHERE a."user_id" = c."id" AND a."day" BETWEEN c."joined" + 7 AND c."joined" + 13
        ))::int AS "returnedWeek2"
    `);
    return row;
  }
}
