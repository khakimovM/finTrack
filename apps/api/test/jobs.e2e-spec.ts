import { addDays, formatIsoDate, parseIsoDate } from '@fintrack/shared';
import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, newUser, today } from './helpers/api-client';
import { RecurringRunnerService } from '../src/modules/recurring/recurring-runner.service';
import { DebtRemindersService } from '../src/modules/debts/debt-reminders.service';

describe('Background jobs & notifications (e2e)', () => {
  let ctx: TestApp;
  let runner: RecurringRunnerService;
  let reminders: DebtRemindersService;

  beforeAll(async () => {
    ctx = await createTestApp();
    runner = ctx.app.get(RecurringRunnerService);
    reminders = ctx.app.get(DebtRemindersService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const shift = (days: number) => formatIsoDate(addDays(parseIsoDate(today()), days));

  async function account(client: ApiClient, name: string, openingBalance = '0'): Promise<string> {
    const res = await client.post('/accounts', { name, type: 'CARD', openingBalance });
    return res.body.data.id as string;
  }

  async function occurrenceDates(ruleId: string, includeDeleted = false): Promise<string[]> {
    const rows = await ctx.prisma.transaction.findMany({
      where: { recurringRuleId: ruleId, ...(includeDeleted ? {} : { deletedAt: null }) },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => formatIsoDate(r.date));
  }

  async function notificationsOf(client: ApiClient, type: string) {
    const res = await client.get('/notifications?limit=100');
    return (res.body.data as Array<{ type: string; body: string }>).filter((n) => n.type === type);
  }

  describe('recurring rules', () => {
    it('books today on creation without back-filling a past start date', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Rec');
      const food = await categoryId(user, 'Oziq-ovqat');

      const res = await user.post('/recurring', {
        accountId: acc,
        categoryId: food,
        type: 'EXPENSE',
        amount: '100',
        frequency: 'DAILY',
        startsAt: shift(-10),
      });

      expect(res.status).toBe(201);
      expect(res.body.data.nextRunAt).toBe(shift(1));
      expect(await occurrenceDates(res.body.data.id)).toEqual([today()]);
    });

    it('catches up missed days exactly once, never recreating a deleted occurrence', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Catch-up');
      const rule = (
        await user.post('/recurring', { accountId: acc, type: 'INCOME', amount: '10', frequency: 'DAILY', startsAt: today() })
      ).body.data;

      // Simulate an outage: the schedule is three days behind.
      await ctx.prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRunAt: parseIsoDate(shift(-3)) } });
      await Promise.all([runner.materialize(rule.id), runner.materialize(rule.id)]);
      expect(await occurrenceDates(rule.id)).toEqual([shift(-3), shift(-2), shift(-1), today()]);

      // The user deletes one; replaying the schedule must not bring it back.
      const victim = await ctx.prisma.transaction.findFirstOrThrow({
        where: { recurringRuleId: rule.id, date: parseIsoDate(shift(-2)) },
      });
      expect((await user.delete(`/transactions/${victim.id}`)).status).toBe(204);
      await ctx.prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRunAt: parseIsoDate(shift(-3)) } });
      await runner.materialize(rule.id);

      expect(await occurrenceDates(rule.id)).toEqual([shift(-3), shift(-1), today()]);
      const saved = await ctx.prisma.recurringRule.findUniqueOrThrow({ where: { id: rule.id } });
      expect(formatIsoDate(saved.nextRunAt)).toBe(shift(1));
    });

    it('run-now is idempotent for the same day and refuses inactive rules', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'RunNow');
      const rule = (
        await user.post('/recurring', {
          accountId: acc,
          type: 'INCOME',
          amount: '5',
          frequency: 'MONTHLY',
          startsAt: shift(3),
        })
      ).body.data;

      const first = await user.post(`/recurring/${rule.id}/run-now`);
      const second = await user.post(`/recurring/${rule.id}/run-now`);
      expect(first.status).toBe(200);
      expect(second.body.data.transaction.id).toBe(first.body.data.transaction.id);

      await user.patch(`/recurring/${rule.id}`, { isActive: false });
      const inactive = await user.post(`/recurring/${rule.id}/run-now`);
      expect(inactive.status).toBe(422);
      expect(inactive.body.error.code).toBe('RECURRING_INACTIVE');
    });

    it('skips an occurrence strict mode cannot cover and tells the user', async () => {
      const user = await newUser(ctx);
      await ctx.prisma.user.update({ where: { id: user.userId }, data: { strictMode: true } });
      const acc = await account(user, 'Poor', '50');

      const rule = (
        await user.post('/recurring', { accountId: acc, type: 'EXPENSE', amount: '100', frequency: 'DAILY', startsAt: today() })
      ).body.data;

      expect(await occurrenceDates(rule.id)).toEqual([]);
      expect(await notificationsOf(user, 'RECURRING_SKIPPED')).toHaveLength(1);
      const saved = await ctx.prisma.recurringRule.findUniqueOrThrow({ where: { id: rule.id } });
      expect(formatIsoDate(saved.nextRunAt)).toBe(shift(1));
    });
  });

  describe('notifications', () => {
    it('raises NEGATIVE_BALANCE once per account per day', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Minus', '100');
      const food = await categoryId(user, 'Oziq-ovqat');

      for (let i = 0; i < 3; i++) {
        await user.post('/transactions', { type: 'EXPENSE', accountId: acc, amount: '80', categoryId: food, date: today() });
      }

      const alerts = await notificationsOf(user, 'NEGATIVE_BALANCE');
      expect(alerts).toHaveLength(1);
    });

    it('debt reminders are idempotent across job retries', async () => {
      const user = await newUser(ctx);
      const acc = await account(user, 'Lend');
      await user.post('/debts', {
        direction: 'I_LENT',
        personName: 'Olim',
        accountId: acc,
        amount: '1000',
        dueDate: shift(1),
      });
      await user.post('/debts', {
        direction: 'I_BORROWED',
        personName: 'Karim',
        accountId: acc,
        amount: '1000',
        dueDate: shift(-2),
      });

      await reminders.run();
      await reminders.run();

      expect(await notificationsOf(user, 'DEBT_DUE_SOON')).toHaveLength(1);
      expect(await notificationsOf(user, 'DEBT_OVERDUE')).toHaveLength(1);
    });
  });
});
