import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, today } from './helpers/api-client';
import { forgetAdminStats, registerOwner, signInAsAdmin } from './helpers/admin';
import { RedisService } from '../src/infra/redis/redis.service';
import { ADMIN_STATS_CACHE_PREFIX } from '../src/modules/admin/stats/admin-stats.service';

/**
 * Benchmark for docs/09 J3: the statistics endpoints with 10 000 users and
 * 500 000 entries. Loading the data takes a minute, so it runs only on request:
 *   ADMIN_PERF=1 npx jest --config test/jest-e2e.json test/admin-stats-perf.e2e-spec.ts
 */
const perf = process.env.ADMIN_PERF ? describe : describe.skip;

perf('Admin statistics at scale (benchmark)', () => {
  let ctx: TestApp;
  let admin: ApiClient;

  beforeAll(async () => {
    ctx = await createTestApp();
    await registerOwner(ctx);
    admin = await signInAsAdmin(ctx);

    const db = ctx.prisma;
    await db.$executeRawUnsafe(`
      INSERT INTO "users" ("id", "name", "created_at", "updated_at")
      SELECT gen_random_uuid()::text, 'Perf', now() - random() * interval '365 days', now()
      FROM generate_series(1, 10000)`);
    await db.$executeRawUnsafe(`
      INSERT INTO "accounts" ("id", "user_id", "name", "type", "updated_at")
      SELECT gen_random_uuid()::text, u."id", 'Naqd', 'CASH', now() FROM "users" u WHERE u."name" = 'Perf'`);
    await db.$executeRawUnsafe(`
      INSERT INTO "transactions" ("id", "user_id", "account_id", "type", "amount", "date", "created_at", "updated_at", "source")
      SELECT gen_random_uuid()::text, a."user_id", a."id", 'EXPENSE', 100, c::date, c, now(), 'WEB'
      FROM "accounts" a
      JOIN "users" u ON u."id" = a."user_id" AND u."name" = 'Perf'
      CROSS JOIN generate_series(1, 50) AS n
      CROSS JOIN LATERAL (SELECT now() - random() * interval '365 days' + n * interval '0 seconds' AS c) AS t`);
    await db.$executeRawUnsafe(`
      INSERT INTO "user_activity_days" ("user_id", "day", "channel")
      SELECT u."id", (now() - (random() * 365)::int * interval '1 day')::date, 'WEB'
      FROM "users" u CROSS JOIN generate_series(1, 60)
      WHERE u."name" = 'Perf'
      ON CONFLICT DO NOTHING`);
    await db.$executeRawUnsafe('ANALYZE');
  }, 600_000);

  afterAll(async () => {
    await ctx.close();
  });

  const year = () => {
    const to = today();
    return { from: `${Number(to.slice(0, 4)) - 1}${to.slice(4)}`, to };
  };

  // A year of weeks counted from nothing is the one exception (docs/09, J3): distinct users per week
  // cannot be summed from days, so the first load reads every activity row of the year. Finished
  // weeks are kept afterwards, which the last test measures against the usual 500 ms.
  it.each([
    ['overview', 500, () => '/admin/stats/overview'],
    ['growth by day, 90 days', 500, () => `/admin/stats/growth?from=${year().to.slice(0, 8)}01&to=${year().to}&groupBy=day`],
    ['growth by week, a year, first load', 1000, () => `/admin/stats/growth?from=${year().from}&to=${year().to}&groupBy=week`],
    ['retention, 26 weeks', 500, () => '/admin/stats/retention?cohorts=26'],
    ['usage, 30 days', 500, () => '/admin/stats/usage'],
    ['funnel, a year', 500, () => `/admin/stats/funnel?from=${year().from}&to=${year().to}`],
  ])('%s answers in under %i ms', async (_name, budget, path) => {
    await forgetAdminStats(ctx);
    const started = performance.now();
    const res = await admin.get(path());
    const ms = performance.now() - started;
    // eslint-disable-next-line no-console
    console.log(`${_name}: ${Math.round(ms)} ms`);
    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(budget);
  });

  it('growth by week, a year, with the finished weeks already counted, answers in under 500 ms', async () => {
    const path = `/admin/stats/growth?from=${year().from}&to=${year().to}&groupBy=week`;
    await forgetAdminStats(ctx);
    expect((await admin.get(path)).status).toBe(200);
    // Drop the minute cache only; what the closed weeks counted stays.
    await ctx.app.get(RedisService).delPattern(`${ADMIN_STATS_CACHE_PREFIX}growth:*`);

    const started = performance.now();
    const res = await admin.get(path);
    const ms = performance.now() - started;
    // eslint-disable-next-line no-console
    console.log(`growth by week, a year, warm: ${Math.round(ms)} ms`);
    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(500);
  });
});
