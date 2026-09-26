import { Test, TestingModule } from '@nestjs/testing';
import { Category, Transaction } from '@prisma/client';
import { RecurringService, computeNextRun } from '../recurring.service';
import { RecurringRepository } from '../recurring.repository';
import { AccountsRepository, AccountWithCount } from '../../accounts/accounts.repository';
import { CategoriesRepository } from '../../categories/categories.repository';
import { BalanceService } from '../../accounts/balance.service';
import { BudgetsService } from '../../budgets/budgets.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { NotFoundDomainException } from '../../../common/exceptions/domain.exception';
import { parseIsoDate } from '@fintrack/shared';

describe('RecurringService', () => {
  let service: RecurringService;
  let repository: jest.Mocked<RecurringRepository>;
  let accountsRepository: jest.Mocked<AccountsRepository>;
  let categoriesRepository: jest.Mocked<CategoriesRepository>;
  let balanceService: jest.Mocked<BalanceService>;
  let budgetsService: jest.Mocked<BudgetsService>;
  let prisma: {
    $transaction: jest.Mock;
    transaction: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    recurringRule: {
      update: jest.Mock;
    };
  };

  const mockUserId = 'user-123';
  const mockRuleId = 'rule-123';
  const mockAccountId = 'acc-123';
  const mockCategoryId = 'cat-123';

  const mockRule = {
    id: mockRuleId,
    userId: mockUserId,
    accountId: mockAccountId,
    categoryId: mockCategoryId,
    type: 'EXPENSE' as const,
    amount: 15000000n,
    frequency: 'MONTHLY' as const,
    dayOfCycle: 15,
    startsAt: parseIsoDate('2026-08-15'),
    endsAt: null,
    nextRunAt: parseIsoDate('2026-08-15'),
    isActive: true,
    note: 'Internet to‘lovi',
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
    account: { id: mockAccountId, name: 'Asosiy karta', icon: '💳' },
    category: { id: mockCategoryId, name: 'Kommunal', icon: '🌐', color: '#3b82f6' },
  };

  beforeEach(async () => {
    const mockRepo = {
      findMany: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findDueRules: jest.fn(),
      findExistingTransaction: jest.fn(),
    };

    const mockAccRepo = {
      findById: jest.fn(),
    };

    const mockCatRepo = {
      findById: jest.fn(),
    };

    const mockBalService = {
      invalidate: jest.fn().mockResolvedValue(undefined),
    };

    const mockBudgService = {
      checkAndNotify: jest.fn().mockResolvedValue(null),
    };

    const mockPrisma = {
      $transaction: jest.fn(),
      transaction: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      recurringRule: {
        update: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: RecurringRepository, useValue: mockRepo },
        { provide: AccountsRepository, useValue: mockAccRepo },
        { provide: CategoriesRepository, useValue: mockCatRepo },
        { provide: BalanceService, useValue: mockBalService },
        { provide: BudgetsService, useValue: mockBudgService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RecurringService>(RecurringService);
    repository = module.get(RecurringRepository);
    accountsRepository = module.get(AccountsRepository);
    categoriesRepository = module.get(CategoriesRepository);
    balanceService = module.get(BalanceService);
    budgetsService = module.get(BudgetsService);
    prisma = mockPrisma;
  });

  describe('computeNextRun helper', () => {
    it('correctly calculates daily recurrence', () => {
      const current = parseIsoDate('2026-09-01');
      const next = computeNextRun(current, 'DAILY');
      expect(next.toISOString().startsWith('2026-09-02')).toBe(true);
    });

    it('correctly calculates weekly recurrence', () => {
      const current = parseIsoDate('2026-09-01');
      const next = computeNextRun(current, 'WEEKLY');
      expect(next.toISOString().startsWith('2026-09-08')).toBe(true);
    });

    it('correctly calculates monthly recurrence with dayOfCycle', () => {
      const current = parseIsoDate('2026-08-31');
      const next = computeNextRun(current, 'MONTHLY', 31);
      // September has 30 days, so it should clamp to 30
      expect(next.toISOString().startsWith('2026-09-30')).toBe(true);
    });

    it('correctly calculates yearly recurrence', () => {
      const current = parseIsoDate('2026-08-15');
      const next = computeNextRun(current, 'YEARLY');
      expect(next.toISOString().startsWith('2027-08-15')).toBe(true);
    });
  });

  describe('create', () => {
    it('creates a recurring rule successfully', () => {
      accountsRepository.findById.mockResolvedValue({ id: mockAccountId } as unknown as AccountWithCount);
      categoriesRepository.findById.mockResolvedValue({ id: mockCategoryId, type: 'EXPENSE' } as unknown as Category);
      repository.create.mockResolvedValue(mockRule);

      return expect(
        service.create(mockUserId, {
          accountId: mockAccountId,
          categoryId: mockCategoryId,
          type: 'EXPENSE',
          amount: '15000000',
          frequency: 'MONTHLY',
          dayOfCycle: 15,
          startsAt: '2026-08-15',
        }),
      ).resolves.toMatchObject({
        id: mockRuleId,
        amount: '15000000',
        frequency: 'MONTHLY',
      });
    });

    it('throws NotFoundDomainException if account not found', async () => {
      accountsRepository.findById.mockResolvedValue(null);

      await expect(
        service.create(mockUserId, {
          accountId: 'non-existent',
          type: 'EXPENSE',
          amount: '15000000',
          frequency: 'MONTHLY',
          startsAt: '2026-08-15',
        }),
      ).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('runNow', () => {
    it('creates a transaction immediately and advances nextRunAt', async () => {
      repository.findById.mockResolvedValue(mockRule);
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.transaction.create as jest.Mock).mockResolvedValue({
        id: 'tx-new',
        type: 'EXPENSE',
        amount: 15000000n,
        date: new Date(),
        note: 'Internet to‘lovi',
        account: mockRule.account,
        category: mockRule.category,
        tags: [],
        createdAt: new Date(),
      });
      (prisma.recurringRule.update as jest.Mock).mockResolvedValue({
        ...mockRule,
        nextRunAt: parseIsoDate('2026-09-15'),
      });

      const result = await service.runNow(mockUserId, mockRuleId);

      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(balanceService.invalidate).toHaveBeenCalledWith(mockUserId);
      expect(result.transaction.amount).toBe('15000000');
    });

    it('does not duplicate transaction if run twice on the same day', async () => {
      repository.findById.mockResolvedValue(mockRule);
      const existingTx = {
        id: 'tx-existing',
        type: 'EXPENSE',
        amount: 15000000n,
        date: new Date(),
        note: 'Internet to‘lovi',
        account: mockRule.account,
        category: mockRule.category,
        tags: [],
        createdAt: new Date(),
      };
      (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(existingTx);

      const result = await service.runNow(mockUserId, mockRuleId);

      // Should return existing without creating another transaction
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(result.transaction.id).toBe('tx-existing');
    });
  });

  describe('processDueRules (Worker idempotency)', () => {
    it('worker run once creates transaction and advances nextRunAt', async () => {
      repository.findDueRules.mockResolvedValue([mockRule]);
      repository.findExistingTransaction.mockResolvedValue(null);

      const result = await service.processDueRules(parseIsoDate('2026-08-15'));

      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(0);
      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
      expect(balanceService.invalidate).toHaveBeenCalledWith(mockUserId);
      expect(budgetsService.checkAndNotify).toBeDefined();
    });

    it('worker run twice on the same due date produces NO duplicate transactions', async () => {
      repository.findDueRules.mockResolvedValue([mockRule]);
      // Second run: existing transaction found
      repository.findExistingTransaction.mockResolvedValue({ id: 'tx-already-created' } as unknown as Transaction);

      const result = await service.processDueRules(parseIsoDate('2026-08-15'));

      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(1);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('gracefully handles P2002 unique constraint if concurrent worker races', async () => {
      repository.findDueRules.mockResolvedValue([mockRule]);
      repository.findExistingTransaction.mockResolvedValue(null);

      const p2002Error = Object.assign(new Error('Unique constraint violation'), { code: 'P2002' });
      (prisma.transaction.create as jest.Mock).mockRejectedValue(p2002Error);

      const result = await service.processDueRules(parseIsoDate('2026-08-15'));

      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });
  });

  describe('list and getById', () => {
    it('lists recurring rules', async () => {
      repository.findMany.mockResolvedValue([mockRule]);

      const result = await service.list(mockUserId, true);

      expect(repository.findMany).toHaveBeenCalledWith(mockUserId, true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockRuleId);
    });

    it('returns recurring rule by id', async () => {
      repository.findById.mockResolvedValue(mockRule);

      const result = await service.getById(mockUserId, mockRuleId);

      expect(result.id).toBe(mockRuleId);
      expect(repository.findById).toHaveBeenCalledWith(mockUserId, mockRuleId);
    });

    it('throws NotFoundDomainException if rule does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById(mockUserId, 'rule-404')).rejects.toThrow(
        NotFoundDomainException,
      );
    });
  });

  describe('update and delete', () => {
    it('updates recurring rule', async () => {
      repository.findById.mockResolvedValue(mockRule);
      repository.update.mockResolvedValue({
        ...mockRule,
        amount: 20000000n,
        note: 'Yangi summa',
      });

      const result = await service.update(mockUserId, mockRuleId, {
        amount: '20000000',
        note: 'Yangi summa',
      });

      expect(result.amount).toBe('20000000');
      expect(repository.update).toHaveBeenCalled();
    });

    it('throws NotFoundDomainException if updating non-existent rule', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(mockUserId, 'rule-404', { amount: '1000' }),
      ).rejects.toThrow(NotFoundDomainException);
    });

    it('deletes recurring rule', async () => {
      repository.findById.mockResolvedValue(mockRule);

      await service.delete(mockUserId, mockRuleId);

      expect(repository.delete).toHaveBeenCalledWith(mockUserId, mockRuleId);
    });

    it('throws NotFoundDomainException if deleting non-existent rule', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete(mockUserId, 'rule-404')).rejects.toThrow(
        NotFoundDomainException,
      );
    });
  });
});
