import { Transaction } from '@prisma/client';
import { TransactionsService } from '../transactions.service';
import { TransactionsRepository, TransactionWithRelations } from '../transactions.repository';
import { AccountAccessService } from '../../accounts/account-access.service';
import { CategoriesRepository } from '../../categories/categories.repository';
import { TagsRepository } from '../../tags/tags.repository';
import { BalanceService } from '../../accounts/balance.service';
import { BalanceGuardService } from '../../accounts/balance-guard.service';
import { BudgetsService } from '../../budgets/budgets.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { clockStub } from '../../../infra/clock/__tests__/clock.stub';
import { prismaStub } from '../../../infra/prisma/__tests__/prisma.stub';
import {
  FutureDateException,
  InsufficientBalanceException,
  InvalidCategoryTypeException,
  InvalidTransactionTypeException,
  ManagedTransactionException,
  NotFoundDomainException,
} from '../../../common/exceptions/domain.exception';

const USER = 'user-1';
const ACC = '11111111-1111-1111-1111-111111111111';
const ACC2 = '22222222-2222-2222-2222-222222222222';
const CAT = '33333333-3333-3333-3333-333333333333';

function row(overrides: Partial<Transaction> = {}): TransactionWithRelations {
  const base: Transaction = {
    id: 'tx-1',
    userId: USER,
    accountId: ACC,
    type: 'EXPENSE',
    amount: 50_000n,
    amountBase: null,
    categoryId: CAT,
    debtId: null,
    transferGroupId: null,
    recurringRuleId: null,
    source: null,
    date: new Date('2026-09-01T00:00:00Z'),
    note: 'Non',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
  return {
    ...base,
    account: { id: base.accountId, name: 'Karta', icon: '💳' },
    category: base.categoryId ? { id: CAT, name: 'Oziq-ovqat', icon: '🍔', color: '#ef4444' } : null,
    tags: [],
    debt: base.debtId ? { id: base.debtId, personName: 'Jasur Karimov' } : null,
  };
}

function setup() {
  const repository = {
    findMany: jest.fn(),
    calculateSums: jest.fn(),
    findById: jest.fn(),
    findDeletedById: jest.fn(),
    findLiveByIds: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    findTransferPeers: jest.fn().mockResolvedValue(new Map()),
  };
  const accountAccess = { assertWritable: jest.fn().mockResolvedValue(undefined) };
  const categories = {
    findById: jest.fn().mockResolvedValue({ id: CAT, type: 'EXPENSE', parentId: null }),
  };
  const tags = { countOwned: jest.fn() };
  const balanceService = {
    invalidate: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(950_000n),
    getTotalBalance: jest.fn().mockResolvedValue(1_950_000n),
  };
  const guard = { assertCanDebit: jest.fn(), assertDeltas: jest.fn() };
  const budgets = { checkAndNotify: jest.fn().mockResolvedValue(null) };
  const clock = clockStub();
  const prisma = prismaStub();

  const service = new TransactionsService(
    repository as unknown as TransactionsRepository,
    accountAccess as unknown as AccountAccessService,
    categories as unknown as CategoriesRepository,
    tags as unknown as TagsRepository,
    balanceService as unknown as BalanceService,
    guard as unknown as BalanceGuardService,
    budgets as unknown as BudgetsService,
    clock as unknown as ClockService,
    prisma,
  );
  return { service, repository, accountAccess, categories, tags, balanceService, guard, budgets, clock, prisma };
}

const validDto = {
  type: 'EXPENSE' as const,
  accountId: ACC,
  amount: '50000',
  categoryId: CAT,
  date: '2026-09-01',
};

describe('TransactionsService', () => {
  describe('create', () => {
    it('checks strict mode inside the write transaction and invalidates balances after commit', async () => {
      const t = setup();
      t.repository.create.mockResolvedValue(row());

      const res = await t.service.create(USER, validDto, 'WEB');

      expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(t.guard.assertCanDebit).toHaveBeenCalledWith(t.prisma.tx, USER, ACC, 50_000n);
      expect(t.repository.create).toHaveBeenCalledWith(
        t.prisma.tx,
        USER,
        expect.objectContaining({ type: 'EXPENSE', amount: 50_000n }),
        [],
      );
      expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER, expect.any(Array));
      expect(t.budgets.checkAndNotify).toHaveBeenCalledWith(USER, CAT, expect.any(Date));
      expect(res).toMatchObject({ accountBalance: '950000', totalBalance: '1950000' });
      expect(res.transaction.date).toBe('2026-09-01');
    });

    it('does not debit-check income', async () => {
      const t = setup();
      t.categories.findById.mockResolvedValue({ id: CAT, type: 'INCOME' });
      t.repository.create.mockResolvedValue(row({ type: 'INCOME' }));

      await t.service.create(USER, { ...validDto, type: 'INCOME' }, 'WEB');
      expect(t.guard.assertCanDebit).not.toHaveBeenCalled();
      expect(t.budgets.checkAndNotify).not.toHaveBeenCalled();
    });

    it('propagates INSUFFICIENT_BALANCE and does not invalidate anything', async () => {
      const t = setup();
      t.guard.assertCanDebit.mockRejectedValue(new InsufficientBalanceException());

      await expect(t.service.create(USER, validDto, 'WEB')).rejects.toBeInstanceOf(InsufficientBalanceException);
      expect(t.repository.create).not.toHaveBeenCalled();
      expect(t.balanceService.invalidate).not.toHaveBeenCalled();
    });

    it('rejects loan/transfer types with INVALID_TRANSACTION_TYPE', async () => {
      const t = setup();
      await expect(
        t.service.create(USER, { ...validDto, type: 'LOAN_GIVEN' as unknown as 'EXPENSE' }, 'WEB'),
      ).rejects.toBeInstanceOf(InvalidTransactionTypeException);
    });

    it('rejects a date after the user’s today', async () => {
      const t = setup();
      await expect(t.service.create(USER, { ...validDto, date: '2999-01-01' }, 'WEB')).rejects.toBeInstanceOf(
        FutureDateException,
      );
      expect(t.clock.assertNotFuture).toHaveBeenCalledWith(USER, '2999-01-01');
    });

    it('requires a category of the same type', async () => {
      const t = setup();
      t.categories.findById.mockResolvedValue({ id: CAT, type: 'INCOME' });
      await expect(t.service.create(USER, validDto, 'WEB')).rejects.toBeInstanceOf(InvalidCategoryTypeException);
    });

    it('returns 404 when a tag is not the user’s', async () => {
      const t = setup();
      t.tags.countOwned.mockResolvedValue(0);
      await expect(
        t.service.create(USER, { ...validDto, tagIds: ['44444444-4444-4444-4444-444444444444'] }, 'WEB'),
      ).rejects.toBeInstanceOf(NotFoundDomainException);
    });
  });

  describe('list', () => {
    it('names the debt person and the other leg of a transfer, and passes the filter counts through', async () => {
      const t = setup();
      const transfer = row({ id: 'tx-t', type: 'TRANSFER_OUT', categoryId: null, transferGroupId: 'tg_1' });
      const loan = row({ id: 'tx-l', type: 'LOAN_GIVEN', categoryId: null, debtId: 'd1' });
      t.repository.findMany.mockResolvedValue({ transactions: [transfer, loan], total: 2 });
      t.repository.calculateSums.mockResolvedValue({ income: '0', expense: '0', incomeCount: 0, expenseCount: 0 });
      t.repository.findTransferPeers.mockResolvedValue(
        new Map([['tx-t', { accountId: ACC2, name: 'Jamg‘arma', icon: '🏦' }]]),
      );

      const res = await t.service.list(USER, { page: 1, limit: 20, sort: 'date:desc' });

      expect(res.data[0].transferPeer).toEqual({ accountId: ACC2, name: 'Jamg‘arma', icon: '🏦' });
      expect(res.data[0].debt).toBeNull();
      expect(res.data[1].debt).toEqual({ id: 'd1', personName: 'Jasur Karimov' });
      expect(res.data[1].transferPeer).toBeNull();
      expect(res.meta.sums).toEqual({ income: '0', expense: '0', incomeCount: 0, expenseCount: 0 });
    });
  });

  describe('update', () => {
    it('moving an expense to another account debit-checks the new account for the full amount', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(row());
      t.repository.update.mockResolvedValue(row({ accountId: ACC2 }));

      await t.service.update(USER, 'tx-1', { accountId: ACC2 });

      expect(t.guard.assertDeltas).toHaveBeenCalledWith(
        t.prisma.tx,
        USER,
        new Map([
          [ACC, 50_000n],
          [ACC2, -50_000n],
        ]),
      );
    });

    it('lowering an income is a debit on its account', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(row({ type: 'INCOME', amount: 100_000n }));
      t.repository.update.mockResolvedValue(row({ type: 'INCOME', amount: 40_000n }));

      await t.service.update(USER, 'tx-1', { amount: '40000' });

      expect(t.guard.assertDeltas).toHaveBeenCalledWith(t.prisma.tx, USER, new Map([[ACC, -60_000n]]));
    });

    it.each([
      ['TRANSFER_OUT', { transferGroupId: 'tg_1' }],
      ['LOAN_REPAY_IN', { debtId: 'd1' }],
    ] as const)('refuses to edit a %s row (MANAGED_TRANSACTION)', async (type, refs) => {
      const t = setup();
      t.repository.findById.mockResolvedValue(row({ type, categoryId: null, ...refs }));

      const error = await t.service.update(USER, 'tx-1', { amount: '1' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ManagedTransactionException);
      expect(error).toMatchObject({ details: expect.objectContaining(refs) });
      expect(t.repository.update).not.toHaveBeenCalled();
    });

    it('switching an expense to income moves the balance by twice the amount and saves the new type', async () => {
      const t = setup();
      const INCOME_CAT = '44444444-4444-4444-4444-444444444444';
      t.categories.findById.mockResolvedValue({ id: INCOME_CAT, type: 'INCOME', parentId: null });
      t.repository.findById.mockResolvedValue(row());
      t.repository.update.mockResolvedValue(row({ type: 'INCOME', categoryId: INCOME_CAT }));

      await t.service.update(USER, 'tx-1', { type: 'INCOME', categoryId: INCOME_CAT });

      expect(t.categories.findById).toHaveBeenCalledWith(USER, INCOME_CAT);
      expect(t.guard.assertDeltas).toHaveBeenCalledWith(t.prisma.tx, USER, new Map([[ACC, 100_000n]]));
      expect(t.repository.update).toHaveBeenCalledWith(
        t.prisma.tx,
        USER,
        'tx-1',
        expect.objectContaining({ type: 'INCOME', categoryId: INCOME_CAT }),
        undefined,
      );
    });

    it('refuses a type switch that keeps a category of the old type', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(row());

      await expect(t.service.update(USER, 'tx-1', { type: 'INCOME' })).rejects.toBeInstanceOf(
        InvalidCategoryTypeException,
      );
      expect(t.repository.update).not.toHaveBeenCalled();
    });

    it('returns 404 for another user’s transaction', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(null);
      await expect(t.service.update(USER, 'tx-x', { note: 'x' })).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });
  });

  describe('delete / bulkDelete / restore', () => {
    it('deleting an income is a guarded debit', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(row({ type: 'INCOME', amount: 70_000n }));

      await t.service.delete(USER, 'tx-1');

      expect(t.guard.assertDeltas).toHaveBeenCalledWith(t.prisma.tx, USER, new Map([[ACC, -70_000n]]));
      expect(t.repository.softDelete).toHaveBeenCalledWith(t.prisma.tx, USER, ['tx-1']);
      expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER, expect.any(Array));
    });

    it('refuses to delete a loan row', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(row({ type: 'LOAN_GIVEN', debtId: 'd1', categoryId: null }));
      await expect(t.service.delete(USER, 'tx-1')).rejects.toBeInstanceOf(ManagedTransactionException);
      expect(t.repository.softDelete).not.toHaveBeenCalled();
    });

    it('bulk delete rejects the whole batch if any managed row is included', async () => {
      const t = setup();
      t.repository.findLiveByIds.mockResolvedValue([
        row({ id: 'a' }),
        row({ id: 'b', type: 'TRANSFER_IN', transferGroupId: 'tg', categoryId: null }),
      ]);

      await expect(t.service.bulkDelete(USER, { ids: ['a', 'b'] })).rejects.toMatchObject({
        code: 'MANAGED_TRANSACTION',
        details: { transactionIds: ['b'] },
      });
      expect(t.repository.softDelete).not.toHaveBeenCalled();
    });

    it('bulk delete sums the balance effect per account', async () => {
      const t = setup();
      t.repository.findLiveByIds.mockResolvedValue([
        row({ id: 'a', type: 'INCOME', amount: 100n }),
        row({ id: 'b', type: 'EXPENSE', amount: 30n }),
      ]);

      await t.service.bulkDelete(USER, { ids: ['a', 'b'] });

      expect(t.guard.assertDeltas).toHaveBeenCalledWith(t.prisma.tx, USER, new Map([[ACC, -70n]]));
      expect(t.repository.softDelete).toHaveBeenCalledWith(t.prisma.tx, USER, ['a', 'b']);
    });

    it('restoring an expense is a guarded debit and re-checks the budget', async () => {
      const t = setup();
      t.repository.findDeletedById.mockResolvedValue(row({ deletedAt: new Date() }));
      t.repository.findById.mockResolvedValue(row());

      await t.service.restore(USER, 'tx-1');

      expect(t.guard.assertDeltas).toHaveBeenCalledWith(t.prisma.tx, USER, new Map([[ACC, -50_000n]]));
      expect(t.repository.restore).toHaveBeenCalledWith(t.prisma.tx, USER, 'tx-1');
      expect(t.budgets.checkAndNotify).toHaveBeenCalled();
    });
  });
});
