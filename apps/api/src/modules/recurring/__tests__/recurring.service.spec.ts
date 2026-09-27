import { RecurringRule, Transaction } from '@prisma/client';
import { parseIsoDate, formatIsoDate } from '@fintrack/shared';
import { RecurringRunnerService } from '../recurring-runner.service';
import { RecurringService } from '../recurring.service';
import { LockedRule, RecurringRepository } from '../recurring.repository';
import { BalanceService } from '../../accounts/balance.service';
import { BalanceGuardService } from '../../accounts/balance-guard.service';
import { AccountAccessService } from '../../accounts/account-access.service';
import { CategoriesRepository } from '../../categories/categories.repository';
import { BudgetsService } from '../../budgets/budgets.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { prismaStub } from '../../../infra/prisma/__tests__/prisma.stub';
import { InsufficientBalanceException } from '../../../common/exceptions/domain.exception';

const USER = 'user-1';
const RULE = 'rule-1';
const ACC = 'acc-1';

function lockedRule(overrides: Partial<LockedRule> = {}): LockedRule {
  const base: RecurringRule = {
    id: RULE,
    userId: USER,
    accountId: ACC,
    categoryId: 'cat-1',
    type: 'EXPENSE',
    amount: 100n,
    note: 'Internet',
    frequency: 'DAILY',
    dayOfCycle: null,
    startsAt: parseIsoDate('2026-09-01'),
    endsAt: null,
    nextRunAt: parseIsoDate('2026-09-25'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, timezone: 'Asia/Tashkent', accountActive: true, ...overrides };
}

function occurrence(date: Date): Transaction & { account: never; category: null; tags: [] } {
  return {
    id: `tx-${formatIsoDate(date)}`,
    userId: USER,
    accountId: ACC,
    type: 'EXPENSE',
    amount: 100n,
    amountBase: null,
    categoryId: 'cat-1',
    debtId: null,
    transferGroupId: null,
    recurringRuleId: RULE,
    date,
    note: 'Internet',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    account: { id: ACC, name: 'Karta', icon: '💳' } as never,
    category: null,
    tags: [],
  };
}

function setup(today = '2026-09-27') {
  const repository = {
    lock: jest.fn(),
    findOccurrence: jest.fn().mockResolvedValue(null),
    findLiveOccurrence: jest.fn().mockResolvedValue(null),
    createOccurrence: jest.fn(async (_db: unknown, _rule: unknown, date: Date) => occurrence(date)),
    saveSchedule: jest.fn(async (_db: unknown, _id: string, nextRunAt: Date, isActive: boolean) => ({
      ...lockedRule(),
      nextRunAt,
      isActive,
    })),
    findDueRuleIds: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  };
  const balanceService = { invalidate: jest.fn() };
  const guard = { assertCanDebit: jest.fn() };
  const budgets = { checkAndNotify: jest.fn() };
  const notifications = { createSafe: jest.fn() };
  const clock = {
    now: jest.fn(() => new Date(`${today}T06:00:00Z`)),
    todayIn: jest.fn(() => today),
    todayFor: jest.fn(async () => today),
  };
  const prisma = prismaStub();

  const runner = new RecurringRunnerService(
    repository as unknown as RecurringRepository,
    balanceService as unknown as BalanceService,
    guard as unknown as BalanceGuardService,
    budgets as unknown as BudgetsService,
    notifications as unknown as NotificationsService,
    clock as unknown as ClockService,
    prisma,
  );
  const service = new RecurringService(
    repository as unknown as RecurringRepository,
    runner,
    { assertWritable: jest.fn() } as unknown as AccountAccessService,
    { findById: jest.fn().mockResolvedValue({ id: 'cat-1', type: 'EXPENSE' }) } as unknown as CategoriesRepository,
    guard as unknown as BalanceGuardService,
    clock as unknown as ClockService,
    prisma,
  );
  return { runner, service, repository, balanceService, guard, budgets, notifications, prisma };
}

describe('RecurringRunnerService.materialize', () => {
  it('catches up every missed occurrence up to the owner’s today and advances the schedule', async () => {
    const t = setup('2026-09-27');
    t.repository.lock.mockResolvedValue(lockedRule());

    const result = await t.runner.materialize(RULE);

    expect(result?.created.map((tx) => formatIsoDate(tx.date))).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(t.repository.saveSchedule).toHaveBeenCalledWith(t.prisma.tx, RULE, parseIsoDate('2026-09-28'), true);
    expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER, [ACC]);
    expect(t.notifications.createSafe).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ type: 'RECURRING_CREATED', dedupeKey: `recurring-created:${RULE}:2026-09-27` }),
    );
  });

  it('never recreates an occurrence that already exists (even soft-deleted) but still moves on', async () => {
    const t = setup('2026-09-26');
    t.repository.lock.mockResolvedValue(lockedRule());
    t.repository.findOccurrence.mockImplementation(async (_db: unknown, _id: string, date: Date) =>
      formatIsoDate(date) === '2026-09-25' ? { id: 'deleted', deletedAt: new Date() } : null,
    );

    const result = await t.runner.materialize(RULE);

    expect(result?.created.map((tx) => formatIsoDate(tx.date))).toEqual(['2026-09-26']);
    expect(t.repository.saveSchedule).toHaveBeenCalledWith(t.prisma.tx, RULE, parseIsoDate('2026-09-27'), true);
  });

  it('skips an occurrence refused by strict mode and notifies once per date', async () => {
    const t = setup('2026-09-25');
    t.repository.lock.mockResolvedValue(lockedRule());
    t.guard.assertCanDebit.mockRejectedValue(new InsufficientBalanceException());

    const result = await t.runner.materialize(RULE);

    expect(result?.created).toHaveLength(0);
    expect(result?.skippedDates).toEqual(['2026-09-25']);
    expect(t.notifications.createSafe).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ type: 'RECURRING_SKIPPED', dedupeKey: `recurring-skipped:${RULE}:2026-09-25` }),
    );
    expect(t.balanceService.invalidate).not.toHaveBeenCalled();
  });

  it('deactivates the rule once it passes endsAt', async () => {
    const t = setup('2026-09-27');
    t.repository.lock.mockResolvedValue(lockedRule({ endsAt: parseIsoDate('2026-09-26') }));

    await t.runner.materialize(RULE);

    expect(t.repository.createOccurrence).toHaveBeenCalledTimes(2);
    expect(t.repository.saveSchedule).toHaveBeenCalledWith(t.prisma.tx, RULE, parseIsoDate('2026-09-27'), false);
  });

  it('stops the rule when its account is archived', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(lockedRule({ accountActive: false }));

    const result = await t.runner.materialize(RULE);

    expect(result?.deactivatedReason).toBe('ACCOUNT_UNAVAILABLE');
    expect(t.repository.createOccurrence).not.toHaveBeenCalled();
    expect(t.repository.saveSchedule).toHaveBeenCalledWith(t.prisma.tx, RULE, expect.any(Date), false);
  });

  it('ignores inactive or vanished rules', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(null);
    await expect(t.runner.materialize(RULE)).resolves.toBeNull();
  });

  it('processDueRules isolates failures per rule', async () => {
    const t = setup();
    t.repository.findDueRuleIds.mockResolvedValue(['a', 'b']);
    t.repository.lock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(lockedRule({ nextRunAt: parseIsoDate('2026-09-27') }));

    const summary = await t.runner.processDueRules();

    expect(summary).toEqual({ rules: 2, created: 1, skipped: 0, errors: 1 });
  });
});

describe('RecurringService', () => {
  it('anchors a monthly rule on its start day and does not back-fill the past', async () => {
    const t = setup('2026-09-27');
    t.repository.create.mockResolvedValue({ id: RULE });
    t.repository.lock.mockResolvedValue(null);
    t.repository.findById.mockResolvedValue({ ...lockedRule(), account: {}, category: null });

    await t.service.create(USER, {
      accountId: ACC,
      type: 'EXPENSE',
      amount: '100',
      frequency: 'MONTHLY',
      startsAt: '2026-01-31',
    });

    expect(t.repository.create).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ dayOfCycle: 31, nextRunAt: parseIsoDate('2026-09-30') }),
    );
  });

  it('run-now refuses inactive rules', async () => {
    const t = setup();
    t.repository.findById.mockResolvedValue({ ...lockedRule({ isActive: false }), account: {}, category: null });
    await expect(t.service.runNow(USER, RULE)).rejects.toMatchObject({ code: 'RECURRING_INACTIVE' });
  });

  it('run-now returns today’s existing occurrence instead of booking twice', async () => {
    const t = setup('2026-09-27');
    t.repository.findById.mockResolvedValue({ ...lockedRule(), account: {}, category: null });
    t.repository.lock.mockResolvedValue(lockedRule());
    t.repository.findLiveOccurrence.mockResolvedValue(occurrence(parseIsoDate('2026-09-27')));

    const res = await t.service.runNow(USER, RULE);

    expect(res.transaction.date).toBe('2026-09-27');
    expect(t.repository.createOccurrence).not.toHaveBeenCalled();
  });

  it('run-now books today and moves a due schedule past today', async () => {
    const t = setup('2026-09-27');
    t.repository.findById.mockResolvedValue({ ...lockedRule(), account: {}, category: null });
    t.repository.lock.mockResolvedValue(lockedRule({ nextRunAt: parseIsoDate('2026-09-27') }));

    await t.service.runNow(USER, RULE);

    expect(t.guard.assertCanDebit).toHaveBeenCalledWith(t.prisma.tx, USER, ACC, 100n);
    expect(t.repository.saveSchedule).toHaveBeenCalledWith(t.prisma.tx, RULE, parseIsoDate('2026-09-28'), true);
  });

  it('run-now refuses to resurrect an occurrence deleted today', async () => {
    const t = setup('2026-09-27');
    t.repository.findById.mockResolvedValue({ ...lockedRule(), account: {}, category: null });
    t.repository.lock.mockResolvedValue(lockedRule());
    t.repository.findOccurrence.mockResolvedValue({ id: 'x', deletedAt: new Date() });

    await expect(t.service.runNow(USER, RULE)).rejects.toMatchObject({ code: 'RECURRING_ALREADY_RAN' });
  });
});
