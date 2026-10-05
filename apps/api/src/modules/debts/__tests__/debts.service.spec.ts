import { Debt, Transaction } from '@prisma/client';
import { DebtsService } from '../debts.service';
import { DebtPaymentsService } from '../debt-payments.service';
import { DebtsRepository, DebtWithPayments } from '../debts.repository';
import type { DebtPaymentWithAccount } from '../debt.mapper';
import { AccountAccessService } from '../../accounts/account-access.service';
import { BalanceService } from '../../accounts/balance.service';
import { BalanceGuardService } from '../../accounts/balance-guard.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { clockStub } from '../../../infra/clock/__tests__/clock.stub';
import { prismaStub } from '../../../infra/prisma/__tests__/prisma.stub';
import {
  ConflictDomainException,
  DebtOverpaymentException,
  FutureDateException,
  NotFoundDomainException,
} from '../../../common/exceptions/domain.exception';

const USER = 'user-1';
const DEBT_ID = '11111111-1111-1111-1111-111111111111';
const ACCOUNT = '22222222-2222-2222-2222-222222222222';
const created = new Date('2026-09-01T10:00:00Z');

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: DEBT_ID,
    userId: USER,
    direction: 'I_LENT',
    personName: 'Jasur',
    personPhone: null,
    amount: 1_000_000n,
    dueDate: null,
    status: 'ACTIVE',
    paidAt: null,
    note: null,
    createdAt: created,
    updatedAt: created,
    deletedAt: null,
    ...overrides,
  };
}

function withPayments(d: Debt, payments: bigint[] = []): DebtWithPayments {
  return {
    ...d,
    payments: payments.map((amount, i) => ({
      id: `p${i}`,
      debtId: d.id,
      transactionId: `t${i}`,
      amount,
      paidAt: new Date('2026-09-10T00:00:00Z'),
      note: null,
      createdAt: created,
    })),
  };
}

function ledgerRow(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    userId: USER,
    accountId: ACCOUNT,
    type: 'LOAN_GIVEN',
    amount: 1_000_000n,
    amountBase: null,
    categoryId: null,
    debtId: DEBT_ID,
    transferGroupId: null,
    recurringRuleId: null,
    date: new Date('2026-09-01T00:00:00Z'),
    note: null,
    createdAt: created,
    updatedAt: created,
    deletedAt: null,
    ...overrides,
  };
}

function setup() {
  const repository = {
    findMany: jest.fn(),
    summary: jest.fn(),
    findById: jest.fn(),
    lock: jest.fn(),
    paidAmount: jest.fn(),
    createDebt: jest.fn(),
    update: jest.fn(),
    createPayment: jest.fn(),
    setStatus: jest.fn(),
    findPayment: jest.fn(),
    deletePayment: jest.fn(),
    liveLedgerRows: jest.fn(),
    softDelete: jest.fn(),
    findPayments: jest.fn(),
  };
  const accountAccess = { assertWritable: jest.fn().mockResolvedValue(undefined) };
  const balanceService = { invalidate: jest.fn(), getTotalBalance: jest.fn().mockResolvedValue(0n) };
  const guard = { assertCanDebit: jest.fn(), assertDeltas: jest.fn() };
  const clock = clockStub();
  const prisma = prismaStub();

  const deps = [
    repository as unknown as DebtsRepository,
    accountAccess as unknown as AccountAccessService,
    balanceService as unknown as BalanceService,
    guard as unknown as BalanceGuardService,
    clock as unknown as ClockService,
    prisma,
  ] as const;

  return {
    repository,
    accountAccess,
    balanceService,
    guard,
    clock,
    prisma,
    debts: new DebtsService(...deps),
    payments: new DebtPaymentsService(...deps),
  };
}

describe('DebtsService', () => {
  describe('create', () => {
    it('writes debt + LOAN_GIVEN atomically and applies strict mode when lending', async () => {
      const t = setup();
      t.repository.createDebt.mockResolvedValue({
        debt: withPayments(debt()),
        transaction: ledgerRow({ id: 'tx-1' }),
      });

      const result = await t.debts.create(USER, {
        direction: 'I_LENT',
        personName: 'Jasur',
        accountId: ACCOUNT,
        amount: '1000000',
      });

      expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(t.guard.assertCanDebit).toHaveBeenCalledWith(t.prisma.tx, USER, ACCOUNT, 1_000_000n);
      expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER, expect.any(Array));
      expect(result.debt.remainingAmount).toBe('1000000');
      expect(result.transaction.id).toBe('tx-1');
    });

    it('does not debit-check when borrowing (money comes in)', async () => {
      const t = setup();
      t.repository.createDebt.mockResolvedValue({
        debt: withPayments(debt({ direction: 'I_BORROWED' })),
        transaction: ledgerRow({ type: 'LOAN_TAKEN' }),
      });

      await t.debts.create(USER, {
        direction: 'I_BORROWED',
        personName: 'Bank',
        accountId: ACCOUNT,
        amount: '1000000',
      });

      expect(t.guard.assertCanDebit).not.toHaveBeenCalled();
    });

    it('rejects a future ledger date before writing anything', async () => {
      const t = setup();
      await expect(
        t.debts.create(USER, {
          direction: 'I_LENT',
          personName: 'Jasur',
          accountId: ACCOUNT,
          amount: '1',
          date: '2999-01-01',
        }),
      ).rejects.toBeInstanceOf(FutureDateException);
      expect(t.prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('reverses every live ledger row through the strict-mode guard', async () => {
      const t = setup();
      t.repository.lock.mockResolvedValue(debt({ direction: 'I_BORROWED' }));
      t.repository.liveLedgerRows.mockResolvedValue([
        ledgerRow({ type: 'LOAN_TAKEN', amount: 1_000_000n }),
        ledgerRow({ id: 'r', type: 'LOAN_REPAY_OUT', amount: 400_000n }),
      ]);

      await t.debts.delete(USER, DEBT_ID);

      // Removing +1 000 000 and −400 000 leaves the account 600 000 lower.
      expect(t.guard.assertDeltas).toHaveBeenCalledWith(
        t.prisma.tx,
        USER,
        new Map([[ACCOUNT, -600_000n]]),
      );
      expect(t.repository.softDelete).toHaveBeenCalledWith(t.prisma.tx, USER, DEBT_ID);
      expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER, expect.any(Array));
    });

    it('returns 404 for someone else’s debt', async () => {
      const t = setup();
      t.repository.lock.mockResolvedValue(null);
      await expect(t.debts.delete(USER, DEBT_ID)).rejects.toBeInstanceOf(NotFoundDomainException);
      expect(t.repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('responses', () => {
    it('computes isOverdue and daysLeft against the user’s today', async () => {
      const t = setup();
      t.clock.todayFor.mockResolvedValue('2026-09-27');
      t.repository.findById.mockResolvedValue(
        withPayments(debt({ dueDate: new Date('2026-09-20T00:00:00Z') }), [100_000n]),
      );

      const res = await t.debts.getById(USER, DEBT_ID);
      expect(res).toMatchObject({ isOverdue: true, daysLeft: -7, paidAmount: '100000', remainingAmount: '900000' });
    });
  });
});

describe('DebtPaymentsService', () => {
  const humo = { id: ACCOUNT, name: 'Humo karta', icon: '💳' };

  function paymentResult(amount: bigint): { payment: DebtPaymentWithAccount; transaction: Transaction } {
    return {
      payment: {
        id: 'p1',
        debtId: DEBT_ID,
        transactionId: 't1',
        amount,
        paidAt: new Date('2026-09-26T00:00:00Z'),
        note: null,
        createdAt: created,
        transaction: { account: humo },
      },
      transaction: ledgerRow({ id: 't1', type: 'LOAN_REPAY_IN', amount }),
    };
  }

  it('partial payment keeps the debt PARTIALLY_PAID inside the locked transaction', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(debt());
    t.repository.paidAmount.mockResolvedValue(0n);
    t.repository.createPayment.mockResolvedValue(paymentResult(400_000n));
    t.repository.setStatus.mockResolvedValue(withPayments(debt({ status: 'PARTIALLY_PAID' }), [400_000n]));

    const res = await t.payments.createPayment(USER, DEBT_ID, { amount: '400000', accountId: ACCOUNT });

    expect(t.repository.lock).toHaveBeenCalledWith(t.prisma.tx, USER, DEBT_ID);
    expect(t.repository.setStatus).toHaveBeenCalledWith(t.prisma.tx, USER, DEBT_ID, 'PARTIALLY_PAID', null);
    expect(t.guard.assertCanDebit).not.toHaveBeenCalled();
    expect(res.debt.remainingAmount).toBe('600000');
    expect(res.payment.account).toEqual(humo);
  });

  it('final payment flips status to PAID and stamps paidAt in the same transaction', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(debt());
    t.repository.paidAmount.mockResolvedValue(600_000n);
    t.repository.createPayment.mockResolvedValue(paymentResult(400_000n));
    t.repository.setStatus.mockResolvedValue(withPayments(debt({ status: 'PAID' }), [600_000n, 400_000n]));

    await t.payments.createPayment(USER, DEBT_ID, { amount: '400000', accountId: ACCOUNT });

    const [, , , status, paidAt] = t.repository.setStatus.mock.calls[0];
    expect(status).toBe('PAID');
    expect(paidAt).toBeInstanceOf(Date);
  });

  it('rejects overpayment with 422 DEBT_OVERPAYMENT and writes nothing', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(debt());
    t.repository.paidAmount.mockResolvedValue(900_000n);

    const error = await t.payments
      .createPayment(USER, DEBT_ID, { amount: '200000', accountId: ACCOUNT })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DebtOverpaymentException);
    expect(error).toMatchObject({ details: { remainingAmount: '100000', requested: '200000' } });
    expect(t.repository.createPayment).not.toHaveBeenCalled();
  });

  it('rejects any payment on a fully paid debt with DEBT_ALREADY_PAID', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(debt({ status: 'PAID' }));
    t.repository.paidAmount.mockResolvedValue(1_000_000n);

    await expect(
      t.payments.createPayment(USER, DEBT_ID, { amount: '1', accountId: ACCOUNT }),
    ).rejects.toBeInstanceOf(ConflictDomainException);
  });

  it('repaying a borrowed debt goes through the strict-mode guard', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(debt({ direction: 'I_BORROWED' }));
    t.repository.paidAmount.mockResolvedValue(0n);
    t.repository.createPayment.mockResolvedValue(paymentResult(300_000n));
    t.repository.setStatus.mockResolvedValue(withPayments(debt({ direction: 'I_BORROWED' }), [300_000n]));

    await t.payments.createPayment(USER, DEBT_ID, { amount: '300000', accountId: ACCOUNT });

    expect(t.guard.assertCanDebit).toHaveBeenCalledWith(t.prisma.tx, USER, ACCOUNT, 300_000n);
    expect(t.repository.createPayment.mock.calls[0][3]).toMatchObject({ type: 'LOAN_REPAY_OUT' });
  });

  it('settle pays exactly the remaining amount', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(debt());
    t.repository.paidAmount.mockResolvedValue(250_000n);
    t.repository.createPayment.mockResolvedValue(paymentResult(750_000n));
    t.repository.setStatus.mockResolvedValue(withPayments(debt({ status: 'PAID' }), [250_000n, 750_000n]));

    await t.payments.settle(USER, DEBT_ID, { accountId: ACCOUNT });

    expect(t.repository.createPayment.mock.calls[0][3]).toMatchObject({ amount: 750_000n });
  });

  it('deleting a payment reverses its ledger row and recomputes the status', async () => {
    const t = setup();
    t.repository.lock.mockResolvedValue(debt({ status: 'PAID' }));
    t.repository.findPayment.mockResolvedValue({
      ...paymentResult(1_000_000n).payment,
      transaction: ledgerRow({ type: 'LOAN_REPAY_IN', amount: 1_000_000n }),
    });
    t.repository.paidAmount.mockResolvedValue(0n);
    t.repository.setStatus.mockResolvedValue(withPayments(debt()));

    await t.payments.deletePayment(USER, DEBT_ID, 'p1');

    expect(t.guard.assertDeltas).toHaveBeenCalledWith(t.prisma.tx, USER, new Map([[ACCOUNT, -1_000_000n]]));
    expect(t.repository.setStatus).toHaveBeenCalledWith(t.prisma.tx, USER, DEBT_ID, 'ACTIVE', null);
  });
});
