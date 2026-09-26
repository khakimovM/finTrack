import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from '../stats.service';
import { StatsRepository } from '../stats.repository';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { BalanceService } from '../../accounts/balance.service';
import { DebtsRepository } from '../../debts/debts.repository';

describe('StatsService', () => {
  let service: StatsService;
  let repository: jest.Mocked<StatsRepository>;
  let balanceService: jest.Mocked<BalanceService>;
  let debtsRepository: jest.Mocked<DebtsRepository>;
  let redisService: jest.Mocked<RedisService>;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-test-123';

  beforeEach(async () => {
    const mockRepo = {
      getTimeseriesRows: jest.fn(),
      getCategoryStatRows: jest.fn(),
      getAccountStatRows: jest.fn(),
      getStartingBalanceBeforeDate: jest.fn(),
      getDailyBalanceChanges: jest.fn(),
      getPeriodTotals: jest.fn(),
      getTopExpenseCategory: jest.fn(),
      getCategoryExpensesForPeriod: jest.fn(),
    };

    const mockPrisma = {
      category: {
        findMany: jest.fn(),
      },
      debt: {
        findMany: jest.fn(),
      },
    };

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      delPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockBalanceService = {
      getTotalBalance: jest.fn().mockResolvedValue(12550000n),
      getAccountBalances: jest.fn().mockResolvedValue({
        balances: new Map([['acc-1', 8050000n]]),
        total: 8050000n,
      }),
      invalidate: jest.fn().mockResolvedValue(undefined),
    };

    const mockDebtsRepo = {
      calculateSummary: jest.fn().mockResolvedValue({
        owedToMe: 30000000n,
        iOwe: 20000000n,
        net: 10000000n,
        overdueCount: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: StatsRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: DebtsRepository, useValue: mockDebtsRepo },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    repository = module.get(StatsRepository);
    prisma = module.get(PrismaService);
    redisService = module.get(RedisService);
    balanceService = module.get(BalanceService);
    debtsRepository = module.get(DebtsRepository);
  });

  describe('getSummary', () => {
    it('aggregates period KPIs, calculates spent percent and previous period change', async () => {
      repository.getPeriodTotals
        .mockResolvedValueOnce({
          income: 500000000n,
          expense: 437500000n,
          transactionCount: 42,
        })
        .mockResolvedValueOnce({
          income: 500000000n,
          expense: 398000000n,
          transactionCount: 38,
        });

      repository.getAccountStatRows.mockResolvedValueOnce([
        {
          accountId: 'acc-1',
          name: 'Humo karta',
          type: 'CARD',
          color: '#6366f1',
          icon: '💳',
          income: 500000000n,
          expense: 437500000n,
          transactionCount: 42,
        },
      ]);

      repository.getTopExpenseCategory.mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Oziq-ovqat',
        amount: 180000000n,
      });

      const result = await service.getSummary(userId, {
        from: '2026-08-01',
        to: '2026-08-31',
      });

      expect(result.totalBalance).toBe('12550000');
      expect(result.isNegative).toBe(false);
      expect(result.periodIncome).toBe('500000000');
      expect(result.periodExpense).toBe('437500000');
      expect(result.periodNet).toBe('62500000');
      expect(result.spentPercent).toBe(87.5); // 437500000 / 500000000 = 87.5%
      expect(result.debt).toEqual({
        owedToMe: '30000000',
        iOwe: '20000000',
        net: '10000000',
        overdueCount: 1,
      });
      expect(result.topCategory).toEqual({
        id: 'cat-1',
        name: 'Oziq-ovqat',
        amount: '180000000',
      });
      expect(result.previousPeriod.changePercent).toBe(9.92); // (437500000 - 398000000) / 398000000 = 9.92%
      expect(balanceService.getTotalBalance).toHaveBeenCalledWith(userId);
      expect(debtsRepository.calculateSummary).toHaveBeenCalledWith(userId);
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining(`stats:${userId}:summary:2026-08-01:2026-08-31`),
        expect.any(String),
        300,
      );

    });
  });

  describe('getTimeseries (Zero-filling)', () => {
    it('fills missing days with zeros when database returns gaps', async () => {
      // Database only has 2 days with data: 2026-08-01 and 2026-08-03
      repository.getTimeseriesRows.mockResolvedValueOnce([
        { bucket: '2026-08-01', income: 100000n, expense: 50000n },
        { bucket: '2026-08-03', income: 200000n, expense: 80000n },
      ]);

      const result = await service.getTimeseries(userId, {
        from: '2026-08-01',
        to: '2026-08-04',
        groupBy: 'day',
      });

      expect(result.meta.bucketCount).toBe(4);
      expect(result.data).toHaveLength(4);

      // Day 1: data present
      expect(result.data[0]).toEqual({
        bucket: '2026-08-01',
        income: '100000',
        expense: '50000',
        net: '50000',
      });

      // Day 2: zero-filled
      expect(result.data[1]).toEqual({
        bucket: '2026-08-02',
        income: '0',
        expense: '0',
        net: '0',
      });

      // Day 3: data present
      expect(result.data[2]).toEqual({
        bucket: '2026-08-03',
        income: '200000',
        expense: '80000',
        net: '120000',
      });

      // Day 4: zero-filled
      expect(result.data[3]).toEqual({
        bucket: '2026-08-04',
        income: '0',
        expense: '0',
        net: '0',
      });
    });

    it('works seamlessly with groupBy month', async () => {
      repository.getTimeseriesRows.mockResolvedValueOnce([
        { bucket: '2026-01-01', income: 5000000n, expense: 3000000n },
      ]);

      const result = await service.getTimeseries(userId, {
        from: '2026-01-01',
        to: '2026-03-31',
        groupBy: 'month',
      });

      expect(result.data).toHaveLength(3);
      expect(result.data[0].bucket).toBe('2026-01-01');
      expect(result.data[0].income).toBe('5000000');
      expect(result.data[1].bucket).toBe('2026-02-01');
      expect(result.data[1].income).toBe('0');
      expect(result.data[2].bucket).toBe('2026-03-01');
      expect(result.data[2].income).toBe('0');
    });
  });

  describe('getByCategory (Hierarchy & Percentages)', () => {
    it('rolls child categories up into parent category with accurate percentages', async () => {
      repository.getCategoryStatRows.mockResolvedValueOnce([
        {
          categoryId: 'child-1',
          categoryName: 'Restoran',
          icon: '🍽️',
          color: '#ef4444',
          parentId: 'parent-1',
          amount: 40000000n,
          count: 5,
        },
        {
          categoryId: 'parent-1',
          categoryName: 'Oziq-ovqat',
          icon: '🍔',
          color: '#ef4444',
          parentId: null,
          amount: 140000000n,
          count: 13,
        },
      ]);

      (prisma.category.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'parent-1',
          name: 'Oziq-ovqat',
          icon: '🍔',
          color: '#ef4444',
          parentId: null,
        },
        {
          id: 'child-1',
          name: 'Restoran',
          icon: '🍽️',
          color: '#ef4444',
          parentId: 'parent-1',
        },
      ]);

      const result = await service.getByCategory(userId, {
        from: '2026-08-01',
        to: '2026-08-31',
        type: 'EXPENSE',
      });

      expect(result.total).toBe('180000000');
      expect(result.items).toHaveLength(1);

      const parentItem = result.items[0];
      expect(parentItem.categoryId).toBe('parent-1');
      expect(parentItem.name).toBe('Oziq-ovqat');
      expect(parentItem.amount).toBe('180000000'); // 140M + 40M child
      expect(parentItem.percent).toBe(100);
      expect(parentItem.count).toBe(18); // 13 + 5

      expect(parentItem.children).toHaveLength(1);
      expect(parentItem.children[0]).toEqual({
        categoryId: 'child-1',
        name: 'Restoran',
        amount: '40000000',
        percent: 22.22, // 40M / 180M = 22.22%
      });
    });
  });

  describe('getBalanceTrend', () => {
    it('produces continuous cumulative balance from starting balance', async () => {
      repository.getStartingBalanceBeforeDate.mockResolvedValueOnce(10000000n);
      repository.getDailyBalanceChanges.mockResolvedValueOnce([
        { date: '2026-08-01', change: 500000n },
        { date: '2026-08-03', change: -200000n },
      ]);

      const result = await service.getBalanceTrend(userId, {
        from: '2026-08-01',
        to: '2026-08-03',
      });

      expect(result.meta.startingBalance).toBe('10000000');
      expect(result.meta.endingBalance).toBe('10300000');
      expect(result.data).toHaveLength(3);

      expect(result.data[0]).toEqual({
        date: '2026-08-01',
        balance: '10500000',
        change: '500000',
      });
      expect(result.data[1]).toEqual({
        date: '2026-08-02',
        balance: '10500000',
        change: '0',
      });
      expect(result.data[2]).toEqual({
        date: '2026-08-03',
        balance: '10300000',
        change: '-200000',
      });
    });
  });

  describe('getDebts', () => {
    it('calculates debt counts, overdue amount and net balance', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      (prisma.debt.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'd1',
          status: 'ACTIVE',
          amount: 10000000n,
          dueDate: yesterday,
          payments: [{ amount: 2000000n }],
        },
        {
          id: 'd2',
          status: 'PARTIALLY_PAID',
          amount: 5000000n,
          dueDate: null,
          payments: [{ amount: 2500000n }],
        },
        {
          id: 'd3',
          status: 'PAID',
          amount: 8000000n,
          dueDate: null,
          payments: [{ amount: 8000000n }],
        },
      ]);

      const result = await service.getDebts(userId);

      expect(result.owedToMe).toBe('30000000');
      expect(result.iOwe).toBe('20000000');
      expect(result.net).toBe('10000000');
      expect(result.activeCount).toBe(1);
      expect(result.partiallyPaidCount).toBe(1);
      expect(result.paidCount).toBe(1);
      expect(result.overdueAmount).toBe('8000000'); // 10M - 2M paid = 8M overdue
    });
  });

  describe('getCompare', () => {
    it('compares current vs previous periods and category distributions', async () => {
      repository.getPeriodTotals
        .mockResolvedValueOnce({
          income: 500000000n,
          expense: 437500000n,
          transactionCount: 42,
        })
        .mockResolvedValueOnce({
          income: 500000000n,
          expense: 398000000n,
          transactionCount: 38,
        });

      repository.getCategoryExpensesForPeriod
        .mockResolvedValueOnce([
          {
            categoryId: 'cat-1',
            name: 'Oziq-ovqat',
            color: '#ef4444',
            icon: '🍔',
            amount: 180000000n,
          },
        ])
        .mockResolvedValueOnce([
          {
            categoryId: 'cat-1',
            name: 'Oziq-ovqat',
            color: '#ef4444',
            icon: '🍔',
            amount: 150000000n,
          },
        ]);

      const result = await service.getCompare(userId, {
        currentFrom: '2026-08-01',
        currentTo: '2026-08-31',
        previousFrom: '2026-07-01',
        previousTo: '2026-07-31',
      });

      expect(result.current.expense).toBe('437500000');
      expect(result.previous.expense).toBe('398000000');
      expect(result.changes.expenseChange).toBe('39500000');
      expect(result.changes.expenseChangePercent).toBe(9.92);

      expect(result.byCategory).toHaveLength(1);
      expect(result.byCategory[0]).toEqual({
        categoryId: 'cat-1',
        name: 'Oziq-ovqat',
        color: '#ef4444',
        icon: '🍔',
        currentAmount: '180000000',
        previousAmount: '150000000',
        change: '30000000',
        changePercent: 20, // (180M - 150M) / 150M = 20%
      });
    });
  });

  describe('Redis Caching', () => {
    it('returns data directly from cache on hit without hitting repository', async () => {
      const cachedData = {
        totalBalance: '9999',
        isNegative: false,
        periodIncome: '100',
        periodExpense: '50',
        periodNet: '50',
        spentPercent: 50,
        byAccount: [],
        debt: { owedToMe: '0', iOwe: '0', net: '0', overdueCount: 0 },
        topCategory: null,
        transactionCount: 1,
        previousPeriod: { income: '0', expense: '0', changePercent: 0 },
      };

      redisService.get.mockResolvedValueOnce(JSON.stringify(cachedData));

      const result = await service.getSummary(userId, {
        from: '2026-08-01',
        to: '2026-08-31',
      });

      expect(result).toEqual(cachedData);
      expect(repository.getPeriodTotals).not.toHaveBeenCalled();
    });
  });
});
