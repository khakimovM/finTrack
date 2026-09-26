import { Test, TestingModule } from '@nestjs/testing';
import { ClockService } from '../../../infra/clock/clock.service';
import { clockStub } from '../../../infra/clock/__tests__/clock.stub';
import { TransactionsService } from '../transactions.service';
import { TransactionsRepository, TransactionWithRelations } from '../transactions.repository';
import { AccountsRepository } from '../../accounts/accounts.repository';
import { CategoriesRepository } from '../../categories/categories.repository';
import { TagsRepository } from '../../tags/tags.repository';
import { BalanceService } from '../../accounts/balance.service';
import { BalanceGuardService } from '../../accounts/balance-guard.service';
import { BudgetsService } from '../../budgets/budgets.service';
import {
  NotFoundDomainException,
  InvalidCategoryTypeException,
  FutureDateException,
  InsufficientBalanceException,
} from '../../../common/exceptions/domain.exception';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repository: {
    findMany: jest.Mock;
    calculateSums: jest.Mock;
    findById: jest.Mock;
    findDeletedById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    bulkSoftDelete: jest.Mock;
    restore: jest.Mock;
  };
  let accountsRepository: { findById: jest.Mock };
  let categoriesRepository: { findById: jest.Mock };
  let tagsRepository: { findById: jest.Mock };
  let balanceService: {
    getBalance: jest.Mock;
    getTotalBalance: jest.Mock;
    invalidate: jest.Mock;
  };
  let balanceGuardService: { assertSufficient: jest.Mock };

  const mockTx: TransactionWithRelations = {
    id: 'tx-1',
    userId: 'user-1',
    accountId: 'acc-1',
    type: 'EXPENSE',
    amount: 50000n,
    amountBase: null,
    categoryId: 'cat-1',
    debtId: null,
    transferGroupId: null,
    recurringRuleId: null,
    date: new Date('2026-08-15'),
    note: 'Kofe',
    createdAt: new Date('2026-08-15T10:00:00.000Z'),
    updatedAt: new Date('2026-08-15T10:00:00.000Z'),
    deletedAt: null,
    account: { id: 'acc-1', name: 'Karta', icon: '💳' },
    category: { id: 'cat-1', name: 'Kafe', icon: '☕', color: '#6366f1' },
    tags: [],
  };

  beforeEach(async () => {
    repository = {
      findMany: jest.fn(),
      calculateSums: jest.fn(),
      findById: jest.fn(),
      findDeletedById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      bulkSoftDelete: jest.fn(),
      restore: jest.fn(),
    };
    accountsRepository = { findById: jest.fn() };
    categoriesRepository = { findById: jest.fn() };
    tagsRepository = { findById: jest.fn() };
    balanceService = {
      getBalance: jest.fn(),
      getTotalBalance: jest.fn(),
      invalidate: jest.fn(),
    };
    balanceGuardService = { assertSufficient: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TransactionsRepository, useValue: repository },
        { provide: AccountsRepository, useValue: accountsRepository },
        { provide: CategoriesRepository, useValue: categoriesRepository },
        { provide: TagsRepository, useValue: tagsRepository },
        { provide: BalanceService, useValue: balanceService },
        { provide: BalanceGuardService, useValue: balanceGuardService },
        { provide: ClockService, useValue: clockStub() },
        {
          provide: BudgetsService,
          useValue: { checkAndNotify: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('returns paginated transactions with filtered sums', async () => {
      repository.findMany.mockResolvedValue({
        transactions: [mockTx],
        total: 1,
      });
      repository.calculateSums.mockResolvedValue({
        income: '0',
        expense: '50000',
      });

      const res = await service.list('user-1', {
        page: 1,
        limit: 20,
        sort: 'date:desc',
      });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('tx-1');
      expect(res.meta.total).toBe(1);
      expect(res.meta.sums).toEqual({ income: '0', expense: '50000' });
    });
  });

  describe('create', () => {
    const validDto = {
      type: 'EXPENSE' as const,
      accountId: 'acc-1',
      amount: '50000',
      categoryId: 'cat-1',
      date: '2026-08-15',
      note: 'Kofe',
    };

    it('creates expense transaction and invalidates balance cache', async () => {
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });
      categoriesRepository.findById.mockResolvedValue({ id: 'cat-1', type: 'EXPENSE' });
      balanceGuardService.assertSufficient.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(mockTx);
      balanceService.getBalance.mockResolvedValue(950000n);
      balanceService.getTotalBalance.mockResolvedValue(950000n);

      const res = await service.create('user-1', validDto);

      expect(res.transaction.id).toBe('tx-1');
      expect(res.accountBalance).toBe('950000');
      expect(res.totalBalance).toBe('950000');
      expect(balanceGuardService.assertSufficient).toHaveBeenCalledWith('user-1', 'acc-1', 50000n);
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws 422 FUTURE_DATE when transaction date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await expect(
        service.create('user-1', {
          ...validDto,
          date: futureDateStr,
        }),
      ).rejects.toThrow(FutureDateException);
    });

    it('throws 404 when account does not exist or does not belong to user', async () => {
      accountsRepository.findById.mockResolvedValue(null);

      await expect(service.create('user-1', validDto)).rejects.toThrow(NotFoundDomainException);
    });

    it('throws 422 INVALID_CATEGORY_TYPE when category type does not match transaction type', async () => {
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });
      categoriesRepository.findById.mockResolvedValue({ id: 'cat-1', type: 'INCOME' });

      await expect(service.create('user-1', validDto)).rejects.toThrow(InvalidCategoryTypeException);
    });

    it('throws 422 INSUFFICIENT_BALANCE and does NOT create transaction when strictMode rejects', async () => {
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });
      categoriesRepository.findById.mockResolvedValue({ id: 'cat-1', type: 'EXPENSE' });
      balanceGuardService.assertSufficient.mockRejectedValue(
        new InsufficientBalanceException('Balansingiz yetarli emas'),
      );

      await expect(service.create('user-1', validDto)).rejects.toThrow(InsufficientBalanceException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns transaction by id', async () => {
      repository.findById.mockResolvedValue(mockTx);

      const res = await service.getById('user-1', 'tx-1');

      expect(res.id).toBe('tx-1');
      expect(repository.findById).toHaveBeenCalledWith('user-1', 'tx-1');
    });

    it('throws NotFoundDomainException if transaction does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('user-1', 'tx-404')).rejects.toThrow(
        NotFoundDomainException,
      );
    });
  });

  describe('update', () => {
    it('updates transaction and invalidates balance cache', async () => {
      repository.findById.mockResolvedValue(mockTx);
      categoriesRepository.findById.mockResolvedValue({ id: 'cat-2', type: 'EXPENSE' });
      accountsRepository.findById.mockResolvedValue({ id: 'acc-2' });
      repository.update.mockResolvedValue({
        ...mockTx,
        accountId: 'acc-2',
        amount: 60000n,
        note: 'Yangi kofe',
      });

      const res = await service.update('user-1', 'tx-1', {
        accountId: 'acc-2',
        amount: '60000',
        categoryId: 'cat-2',
        note: 'Yangi kofe',
      });

      expect(res.amount).toBe('60000');
      expect(repository.update).toHaveBeenCalled();
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws NotFoundDomainException if transaction not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'tx-404', { note: 'test' }),
      ).rejects.toThrow(NotFoundDomainException);
    });

    it('throws FutureDateException if update date is in the future', async () => {
      repository.findById.mockResolvedValue(mockTx);
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const futureStr = future.toISOString().split('T')[0];

      await expect(
        service.update('user-1', 'tx-1', { date: futureStr }),
      ).rejects.toThrow(FutureDateException);
    });

    it('throws InvalidCategoryTypeException if category type does not match transaction', async () => {
      repository.findById.mockResolvedValue(mockTx);
      categoriesRepository.findById.mockResolvedValue({ id: 'cat-inc', type: 'INCOME' });

      await expect(
        service.update('user-1', 'tx-1', { categoryId: 'cat-inc' }),
      ).rejects.toThrow(InvalidCategoryTypeException);
    });
  });

  describe('delete and restore', () => {
    it('soft deletes transaction and invalidates cache', async () => {
      repository.findById.mockResolvedValue(mockTx);

      await service.delete('user-1', 'tx-1');

      expect(repository.softDelete).toHaveBeenCalledWith('user-1', mockTx);
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws NotFoundDomainException if deleting non-existent transaction', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('user-1', 'tx-404')).rejects.toThrow(
        NotFoundDomainException,
      );
    });

    it('restores transaction and invalidates cache', async () => {
      repository.findDeletedById.mockResolvedValue(mockTx);
      repository.findById.mockResolvedValue(mockTx);

      const res = await service.restore('user-1', 'tx-1');

      expect(res.id).toBe('tx-1');
      expect(repository.restore).toHaveBeenCalledWith('user-1', mockTx);
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws NotFoundDomainException if restoring non-existent transaction', async () => {
      repository.findDeletedById.mockResolvedValue(null);

      await expect(service.restore('user-1', 'tx-404')).rejects.toThrow(
        NotFoundDomainException,
      );
    });
  });

  describe('bulkDelete', () => {
    it('soft deletes multiple transactions and invalidates cache', async () => {
      repository.bulkSoftDelete.mockResolvedValue(3);

      await service.bulkDelete('user-1', { ids: ['tx-1', 'tx-2', 'tx-3'] });

      expect(repository.bulkSoftDelete).toHaveBeenCalledWith('user-1', ['tx-1', 'tx-2', 'tx-3']);
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });
  });
});
