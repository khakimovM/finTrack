import { ActivityChannel, TransactionSource, TransactionType } from '@prisma/client';
import { addDays, formatIsoDate, parseIsoDate, startOfIsoWeek, todayInTimeZone } from '@fintrack/shared';
import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, firstAccountId, newUser, today } from './helpers/api-client';
import { forgetAdminStats, registerOwner, signInAsAdmin } from './helpers/admin';
import { DailyMetricsService } from '../src/modules/activity/daily-metrics.service';

const TZ = 'Asia/Tashkent';
const shift = (day: string, days: number) => formatIsoDate(addDays(parseIsoDate(day), days));

/**
 * Admin statistics (docs/09, J3). Other suites share the database, so exact figures are checked on
 * data placed in March 2025, where nothing else lives; "now" figures are checked as differences.
 */
describe('Admin statistics (e2e)', () => {
  let ctx: TestApp;
  let admin: ApiClient;

  beforeAll(async () => {
    ctx = await createTestApp();
    await registerOwner(ctx);
    admin = await signInAsAdmin(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function get(path: string) {
    await forgetAdminStats(ctx);
    const res = await admin.get(path);
    expect(res.status).toBe(200);
    return res.body.data;
  }

  async function person(createdAt: Date) {
    const user = await ctx.prisma.user.create({ data: { name: 'Tarixiy', createdAt } });
    const account = await ctx.prisma.account.create({ data: { userId: user.id, name: 'Naqd', type: 'CASH', createdAt } });
    return { id: user.id, accountId: account.id };
  }

  async function entry(
    who: { id: string; accountId: string },
    createdAt: Date,
    type: TransactionType = 'EXPENSE',
    source: TransactionSource | null = null,
  ) {
    await ctx.prisma.transaction.create({
      data: { userId: who.id, accountId: who.accountId, type, amount: 100n, date: createdAt, createdAt, source },
    });
  }

  async function active(userId: string, day: string, channel: ActivityChannel = 'WEB') {
    await ctx.prisma.userActivityDay.create({ data: { userId, day: parseIsoDate(day), channel } });
  }

  describe('days are Tashkent days', () => {
    // 2025-03-09 is a Sunday; 18:59 UTC is 23:59 in Tashkent, 19:00 UTC is already Monday.
    let a: { id: string; accountId: string };
    let b: { id: string; accountId: string };

    beforeAll(async () => {
      a = await person(new Date('2025-03-09T18:59:00Z'));
      b = await person(new Date('2025-03-09T19:00:00Z'));
      await active(a.id, '2025-03-09');
      await active(a.id, '2025-03-10', 'BOT');
      await active(b.id, '2025-03-10');
      await entry(a, new Date('2025-03-09T18:30:00Z'), 'EXPENSE', 'BOT');
      await entry(a, new Date('2025-03-09T20:00:00Z'), 'ADJUSTMENT'); // an opening balance: not an entry
      await entry(b, new Date('2025-03-10T05:00:00Z'), 'TRANSFER_OUT', 'WEB');
      await entry(b, new Date('2025-03-10T05:00:00Z'), 'TRANSFER_IN', 'WEB'); // the same transfer: one entry
    });

    it('puts sign-ups, activity and entries on the right day, week and month', async () => {
      const before = await ctx.prisma.user.count({ where: { createdAt: { lt: new Date('2025-03-08T19:00:00Z') } } });

      const days = await get('/admin/stats/growth?from=2025-03-09&to=2025-03-10&groupBy=day');
      expect(days.points).toEqual([
        { bucket: '2025-03-09', newUsers: 1, registeredUsers: before + 1, activeUsers: 1, entries: 1 },
        { bucket: '2025-03-10', newUsers: 1, registeredUsers: before + 2, activeUsers: 2, entries: 1 },
      ]);

      const weeks = await get('/admin/stats/growth?from=2025-03-09&to=2025-03-10&groupBy=week');
      expect(weeks.points.map((p: { bucket: string; newUsers: number }) => [p.bucket, p.newUsers])).toEqual([
        ['2025-03-03', 1],
        ['2025-03-10', 1],
      ]);

      const months = await get('/admin/stats/growth?from=2025-03-01&to=2025-03-31&groupBy=month');
      expect(months.points).toEqual([
        { bucket: '2025-03-01', newUsers: 2, registeredUsers: before + 2, activeUsers: 2, entries: 2 },
      ]);
    });

    it('splits usage by channel and source, and follows sign-ups through the funnel', async () => {
      const usage = await get('/admin/stats/usage?from=2025-03-09&to=2025-03-10');
      expect(usage.activeUsers).toEqual({ total: 2, web: 2, miniApp: 0, bot: 1, unknown: 0 });
      expect(usage.entries).toEqual({ total: 2, web: 1, miniApp: 0, bot: 1, voice: 0, recurring: 0, unknown: 0 });

      // b comes back in its second week and makes five entries.
      await active(b.id, '2025-03-18');
      for (let i = 0; i < 4; i++) await entry(b, new Date('2025-03-18T06:00:00Z'));
      const funnel = await get('/admin/stats/funnel?from=2025-03-09&to=2025-03-10');
      expect(funnel).toEqual({ from: '2025-03-09', to: '2025-03-10', registered: 2, firstEntry: 2, fiveEntries: 1, returnedWeek2: 1 });
    });

    it('rejects a range that ends before it starts or is too long for its buckets', async () => {
      await forgetAdminStats(ctx);
      expect((await admin.get('/admin/stats/growth?from=2025-03-10&to=2025-03-09')).status).toBe(400);
      expect((await admin.get('/admin/stats/growth?from=2020-01-01&to=2025-03-09&groupBy=day')).status).toBe(400);
    });
  });

  it('follows weekly cohorts: who came back in each week after signing up', async () => {
    const thisWeek = formatIsoDate(startOfIsoWeek(parseIsoDate(todayInTimeZone(TZ))));
    const twoWeeksAgo = shift(thisWeek, -14);
    // Signed up on the Monday two weeks ago at 10:00 Tashkent; active then, and a week later.
    const c = await person(new Date(`${twoWeeksAgo}T05:00:00Z`));
    await active(c.id, twoWeeksAgo);
    await active(c.id, shift(twoWeeksAgo, 8));
    const sizeBefore = await ctx.prisma.user.count({
      where: { createdAt: { gte: new Date(`${shift(twoWeeksAgo, -1)}T19:00:00Z`), lt: new Date(`${shift(twoWeeksAgo, 6)}T19:00:00Z`) } },
    });

    const retention = await get('/admin/stats/retention?cohorts=3');
    expect(retention.weeks).toBe(9);
    expect(retention.cohorts.map((x: { week: string }) => x.week)).toEqual([twoWeeksAgo, shift(thisWeek, -7), thisWeek]);
    const cohort = retention.cohorts[0];
    expect(cohort.size).toBe(sizeBefore);
    // Weeks 0 and 1 had activity, week 2 is this week (none yet), weeks 3–8 have not started.
    expect(cohort.active).toEqual([1, 1, 0, null, null, null, null, null, null]);
  });

  it('counts today’s sign-ups, activity and entries, and caches the answer for a minute', async () => {
    const before = await get('/admin/stats/overview');
    expect(before.today).toBe(today());

    const user = await newUser(ctx, 'Bugungi');
    const acc = await firstAccountId(user);
    await user.post('/transactions', { type: 'EXPENSE', accountId: acc, amount: '1000', categoryId: await categoryId(user, 'Oziq-ovqat'), date: today() });

    // Within the cache minute the panel still shows the earlier numbers.
    expect((await admin.get('/admin/stats/overview')).body.data).toEqual(before);

    const after = await get('/admin/stats/overview');
    expect(after.users.total).toBe(before.users.total + 1);
    expect(after.users.newToday).toBe(before.users.newToday + 1);
    expect(after.users.new7d.current).toBe(before.users.new7d.current + 1);
    expect(after.users.activeToday).toBe(before.users.activeToday + 1);
    expect(after.entries.today).toBe(before.entries.today + 1);
    expect(after.entries.total).toBe(before.entries.total + 1);
  });

  it('reports the features people use and the AI assistant’s results', async () => {
    const metrics = ctx.app.get(DailyMetricsService);
    const day = today();
    const before = await get(`/admin/stats/usage?from=${day}&to=${day}`);
    await metrics.increment('ai.voice.ok');
    await metrics.increment('ai.provider.gemini.fail.rate_limited');
    await metrics.increment('ai.provider.groq.ok');

    const usage = await get(`/admin/stats/usage?from=${day}&to=${day}`);
    expect(usage.assistant.voice.ok).toBe(before.assistant.voice.ok + 1);
    const gemini = usage.assistant.providers.find((p: { name: string }) => p.name === 'gemini');
    const geminiBefore = before.assistant.providers.find((p: { name: string }) => p.name === 'gemini');
    expect(gemini.failures.rate_limited).toBe(geminiBefore.failures.rate_limited + 1);
    expect(gemini.failed).toBe(geminiBefore.failed + 1);

    expect(usage.features.users).toBe(await ctx.prisma.user.count({ where: { deletedAt: null } }));
    expect(usage.features.withDebt).toBe(
      await ctx.prisma.user.count({ where: { deletedAt: null, debts: { some: { deletedAt: null } } } }),
    );
  });

  it('never returns an amount, a balance, a name or any other text: only counts, days and fixed keys', async () => {
    const allowed = new Set(['day', 'week', 'month', 'gemini', 'groq', 'claude']);
    const paths = [
      '/admin/stats/overview',
      '/admin/stats/growth?from=2025-03-01&to=2025-03-31&groupBy=week',
      '/admin/stats/retention',
      '/admin/stats/usage',
      '/admin/stats/funnel',
    ];
    const visit = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        expect({ path, integer: Number.isInteger(value) }).toEqual({ path, integer: true });
      } else if (typeof value === 'string') {
        expect({ path, ok: /^\d{4}-\d{2}-\d{2}$/.test(value) || allowed.has(value) }).toEqual({ path, ok: true });
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => visit(item, `${path}[${i}]`));
      } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          // Keys name what is counted (e.g. assistant.text = AI requests from typed text), never content.
          expect(key).not.toMatch(/amount|balance|note|phone|username|message|transcript/i);
          visit(item, `${path}.${key}`);
        }
      }
    };
    for (const path of paths) {
      const res = await admin.get(path);
      expect(res.status).toBe(200);
      visit(res.body.data, path);
    }
  });

  it('is invisible to anyone without an admin session', async () => {
    const user = await newUser(ctx, 'Qiziquvchan');
    for (const path of ['/admin/stats/overview', '/admin/stats/growth?from=2025-03-01&to=2025-03-02', '/admin/stats/usage']) {
      expect((await user.get(path)).status).toBe(404);
      expect((await new ApiClient(ctx).get(path)).status).toBe(404);
    }
  });
});
