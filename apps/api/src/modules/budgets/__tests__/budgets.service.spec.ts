import { Prisma } from '@prisma/client';
import { BudgetsService, percentOf } from '../budgets.service';
import { BudgetsRepository, BudgetWithCategory } from '../budgets.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { CategoriesRepository } from '../../categories/categories.repository';
import { ClockService } from '../../../infra/clock/clock.service';
import { clockStub } from '../../../infra/clock/__tests__/clock.stub';
import { InvalidCategoryTypeException } from '../../../common/exceptions/domain.exception';

const USER = 'user-1';
const FOOD = 'cat-food';
const CAFE = 'cat-cafe';

function budget(overrides: Partial<BudgetWithCategory> = {}): BudgetWithCategory {
  return {
    id: 'b1',
    userId: USER,
    categoryId: FOOD,
    month: new Date('2026-08-01T00:00:00Z'),
    limitAmount: 200_000_000n,
    notifiedAt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: FOOD,
      userId: USER,
      parentId: null,
      name: 'Oziq-ovqat',
      type: 'EXPENSE',
      icon: '🍔',
      color: '#ef4444',
      isSystem: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    ...overrides,
  };
}

function setup() {
  const repository = {
    findByCategoryAndMonth: jest.fn().mockResolvedValue(null),
    findManyByMonth: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    claimThreshold: jest.fn().mockResolvedValue(true),
    expenseByCategory: jest.fn().mockResolvedValue([]),
  };
  const notifications = { createSafe: jest.fn() };
  const categories = { findById: jest.fn().mockResolvedValue({ id: FOOD, type: 'EXPENSE', parentId: null }) };
  const clock = clockStub();
  const service = new BudgetsService(
    repository as unknown as BudgetsRepository,
    notifications as unknown as NotificationsService,
    categories as unknown as CategoriesRepository,
    clock as unknown as ClockService,
  );
  return { service, repository, notifications, categories };
}

describe('percentOf', () => {
  it('computes one-decimal percentages in BigInt', () => {
    expect(percentOf(184_800_000n, 200_000_000n)).toBe(92.4);
    expect(percentOf(0n, 100n)).toBe(0);
    expect(percentOf(1n, 0n)).toBe(0);
    // Far above Number.MAX_SAFE_INTEGER, still exact.
    expect(percentOf(9_000_000_000_000_000_00n, 10_000_000_000_000_000_00n)).toBe(90);
  });
});

describe('BudgetsService', () => {
  describe('getStatus', () => {
    it('rolls subcategory spending into the parent budget and derives state', async () => {
      const t = setup();
      t.repository.findManyByMonth.mockResolvedValue([budget()]);
      t.repository.expenseByCategory.mockResolvedValue([
        { categoryId: FOOD, parentId: null, spent: 150_000_000n },
        { categoryId: CAFE, parentId: FOOD, spent: 34_800_000n },
      ]);

      const res = await t.service.getStatus(USER, '2026-08');

      expect(res.data[0]).toMatchObject({
        spent: '184800000',
        remaining: '15200000',
        percent: 92.4,
        state: 'WARNING',
      });
      expect(res.meta).toEqual({ month: '2026-08', totalLimit: '200000000', totalSpent: '184800000' });
    });

    it('marks spending over the limit as EXCEEDED', async () => {
      const t = setup();
      t.repository.findManyByMonth.mockResolvedValue([budget({ limitAmount: 100n })]);
      t.repository.expenseByCategory.mockResolvedValue([{ categoryId: FOOD, parentId: null, spent: 150n }]);

      const res = await t.service.getStatus(USER, '2026-08');
      expect(res.data[0]).toMatchObject({ state: 'EXCEEDED', remaining: '0', percent: 150 });
    });
  });

  describe('create', () => {
    it('only allows EXPENSE categories', async () => {
      const t = setup();
      t.categories.findById.mockResolvedValue({ id: 'inc', type: 'INCOME' });
      await expect(
        t.service.create(USER, { categoryId: 'inc', month: '2026-08', limitAmount: '100' }),
      ).rejects.toBeInstanceOf(InvalidCategoryTypeException);
    });

    it('maps the unique-constraint race to 409 BUDGET_EXISTS', async () => {
      const t = setup();
      t.repository.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.22.0' }),
      );
      await expect(
        t.service.create(USER, { categoryId: FOOD, month: '2026-08', limitAmount: '100' }),
      ).rejects.toMatchObject({ code: 'BUDGET_EXISTS' });
    });
  });

  describe('update', () => {
    it('re-arms alerts to the level actually reached under the new limit', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(budget({ notifiedAt: 100 }));
      t.repository.expenseByCategory.mockResolvedValue([{ categoryId: FOOD, parentId: null, spent: 85n }]);
      t.repository.update.mockResolvedValue(budget());

      await t.service.update(USER, 'b1', { limitAmount: '100' });
      expect(t.repository.update).toHaveBeenCalledWith(USER, 'b1', { limitAmount: 100n, notifiedAt: 80 });
    });
  });

  describe('checkAndNotify', () => {
    it('announces the 80% threshold once, via an atomic claim', async () => {
      const t = setup();
      t.repository.findByCategoryAndMonth.mockResolvedValue(budget());
      t.repository.expenseByCategory.mockResolvedValue([{ categoryId: FOOD, parentId: null, spent: 170_000_000n }]);

      const alert = await t.service.checkAndNotify(USER, FOOD, new Date('2026-08-15T00:00:00Z'));

      expect(t.repository.claimThreshold).toHaveBeenCalledWith(USER, 'b1', 80);
      expect(t.notifications.createSafe).toHaveBeenCalledWith(
        USER,
        expect.objectContaining({ type: 'BUDGET_WARNING' }),
      );
      expect(alert).toMatchObject({ percent: 85, categoryId: FOOD });
    });

    it('does not notify when another request already claimed the threshold', async () => {
      const t = setup();
      t.repository.findByCategoryAndMonth.mockResolvedValue(budget());
      t.repository.expenseByCategory.mockResolvedValue([{ categoryId: FOOD, parentId: null, spent: 170_000_000n }]);
      t.repository.claimThreshold.mockResolvedValue(false);

      await t.service.checkAndNotify(USER, FOOD, new Date('2026-08-15T00:00:00Z'));
      expect(t.notifications.createSafe).not.toHaveBeenCalled();
    });

    it('a subcategory expense also checks the parent’s budget', async () => {
      const t = setup();
      t.categories.findById.mockResolvedValue({ id: CAFE, type: 'EXPENSE', parentId: FOOD });
      t.repository.findByCategoryAndMonth.mockImplementation(async (_u: string, categoryId: string) =>
        categoryId === FOOD ? budget({ limitAmount: 100n }) : null,
      );
      t.repository.expenseByCategory.mockResolvedValue([{ categoryId: CAFE, parentId: FOOD, spent: 120n }]);

      await t.service.checkAndNotify(USER, CAFE, new Date('2026-08-15T00:00:00Z'));

      expect(t.repository.claimThreshold).toHaveBeenCalledWith(USER, 'b1', 100);
      expect(t.notifications.createSafe).toHaveBeenCalledWith(
        USER,
        expect.objectContaining({ type: 'BUDGET_EXCEEDED' }),
      );
    });

    it('never throws — a failing budget check must not fail the transaction', async () => {
      const t = setup();
      t.categories.findById.mockRejectedValue(new Error('db down'));
      await expect(t.service.checkAndNotify(USER, FOOD, new Date())).resolves.toBeNull();
    });
  });
});
