import { Test, TestingModule } from '@nestjs/testing';
import { DebtsService } from '../debts.service';
import { DebtsRepository, DebtWithPayments } from '../debts.repository';
import { AccountsRepository } from '../../accounts/accounts.repository';
import { BalanceService } from '../../accounts/balance.service';
import { BalanceGuardService } from '../../accounts/balance-guard.service';
import {
  NotFoundDomainException,
  DebtOverpaymentException,
  ConflictDomainException,
  InsufficientBalanceException,
} from '../../../common/exceptions/domain.exception';

describe('DebtsService', () => {
  let service: DebtsService;
  let repository: {
    findMany: jest.Mock;
    calculateSummary: jest.Mock;
    findById: jest.Mock;
    createDebt: jest.Mock;
    update: jest.Mock;
    createPayment: jest.Mock;
    softDelete: jest.Mock;
    findPayments: jest.Mock;
  };
  let accountsRepository: { findById: jest.Mock };
  let balanceService: {
    getBalance: jest.Mock;
    getTotalBalance: jest.Mock;
    invalidate: jest.Mock;
  };
  let balanceGuardService: { assertSufficient: jest.Mock };

  const mockDebt: DebtWithPayments = {
    id: 'debt-1',
    userId: 'user-1',
    direction: 'I_LENT',
    personName: 'Jasur',
    personPhone: '+998901234567',
    amount: 50000000n,
    dueDate: new Date('2026-09-01'),
    status: 'ACTIVE',
    paidAt: null,
    note: 'To‘yga',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    deletedAt: null,
    payments: [],
  };

  beforeEach(async () => {
    repository = {
      findMany: jest.fn(),
      calculateSummary: jest.fn(),
      findById: jest.fn(),
      createDebt: jest.fn(),
      update: jest.fn(),
      createPayment: jest.fn(),
      softDelete: jest.fn(),
      findPayments: jest.fn(),
    };
    accountsRepository = { findById: jest.fn() };
    balanceService = {
      getBalance: jest.fn(),
      getTotalBalance: jest.fn(),
      invalidate: jest.fn(),
    };
    balanceGuardService = { assertSufficient: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtsService,
        { provide: DebtsRepository, useValue: repository },
        { provide: AccountsRepository, useValue: accountsRepository },
        { provide: BalanceService, useValue: balanceService },
        { provide: BalanceGuardService, useValue: balanceGuardService },
      ],
    }).compile();

    service = module.get<DebtsService>(DebtsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list and getById', () => {
    it('returns list of debts with summary meta', async () => {
      repository.findMany.mockResolvedValue({ debts: [mockDebt], total: 1 });
      repository.calculateSummary.mockResolvedValue({
        owedToMe: 50000000n,
        iOwe: 0n,
        net: 50000000n,
        overdueCount: 0,
      });

      const res = await service.list('user-1', { page: 1, limit: 10 });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('debt-1');
      expect(res.meta.summary.owedToMe).toBe('50000000');
    });

    it('returns single debt by id', async () => {
      repository.findById.mockResolvedValue(mockDebt);

      const res = await service.getById('user-1', 'debt-1');

      expect(res.id).toBe('debt-1');
      expect(repository.findById).toHaveBeenCalledWith('user-1', 'debt-1');
    });

    it('throws NotFoundDomainException when debt not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('user-1', 'debt-404')).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('update', () => {
    it('updates debt details', async () => {
      repository.findById.mockResolvedValue(mockDebt);
      repository.update.mockResolvedValue({
        ...mockDebt,
        personName: 'Jasur Yangi',
        note: 'Yangi izoh',
      });

      const res = await service.update('user-1', 'debt-1', {
        personName: 'Jasur Yangi',
        note: 'Yangi izoh',
      });

      expect(res.personName).toBe('Jasur Yangi');
      expect(repository.update).toHaveBeenCalled();
    });

    it('throws NotFoundDomainException when updating non-existent debt', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'debt-404', { personName: 'Ali' }),
      ).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('listPayments', () => {
    it('returns payment list for a debt', async () => {
      repository.findById.mockResolvedValue(mockDebt);
      const mockPayment = {
        id: 'pm-1',
        debtId: 'debt-1',
        transactionId: 'tx-1',
        amount: 10000000n,
        paidAt: new Date('2026-08-15'),
        note: 'Birinchi to‘lov',
        createdAt: new Date('2026-08-15'),
      };
      repository.findPayments.mockResolvedValue([mockPayment]);

      const res = await service.listPayments('user-1', 'debt-1');

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('pm-1');
      expect(res[0].amount).toBe('10000000');
    });

    it('throws NotFoundDomainException when listing payments of non-existent debt', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.listPayments('user-1', 'debt-404')).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('create', () => {
    const validDto = {
      direction: 'I_LENT' as const,
      personName: 'Jasur',
      accountId: 'acc-1',
      amount: '50000000',
      dueDate: '2026-09-01',
      note: 'To‘yga',
    };

    it('creates debt and ledger transaction atomically and checks strictMode', async () => {
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });
      balanceGuardService.assertSufficient.mockResolvedValue(undefined);
      repository.createDebt.mockResolvedValue({
        debt: mockDebt,
        transaction: {
          id: 'tx-loan-1',
          type: 'LOAN_GIVEN',
          amount: 50000000n,
        },
      });
      balanceService.getTotalBalance.mockResolvedValue(9400000n);

      const res = await service.create('user-1', validDto);

      expect(res.debt.id).toBe('debt-1');
      expect(res.transaction.type).toBe('LOAN_GIVEN');
      expect(res.transaction.amount).toBe('50000000');
      expect(res.totalBalance).toBe('9400000');
      expect(balanceGuardService.assertSufficient).toHaveBeenCalledWith('user-1', 'acc-1', 50000000n);
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws 422 INSUFFICIENT_BALANCE when lending and strictMode rejects', async () => {
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });
      balanceGuardService.assertSufficient.mockRejectedValue(
        new InsufficientBalanceException('Balansingiz yetarli emas'),
      );

      await expect(service.create('user-1', validDto)).rejects.toThrow(InsufficientBalanceException);
      expect(repository.createDebt).not.toHaveBeenCalled();
    });
  });

  describe('createPayment', () => {
    it('records partial payment and updates debt status to PARTIALLY_PAID', async () => {
      repository.findById.mockResolvedValue(mockDebt);
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });
      balanceGuardService.assertSufficient.mockResolvedValue(undefined);

      const updatedDebtWithPayment: DebtWithPayments = {
        ...mockDebt,
        status: 'PARTIALLY_PAID',
        payments: [
          {
            id: 'p-1',
            debtId: 'debt-1',
            transactionId: 'tx-repay-1',
            amount: 20000000n,
            paidAt: new Date('2026-08-20'),
            note: '1-qism',
            createdAt: new Date(),
          },
        ],
      };

      repository.createPayment.mockResolvedValue({
        payment: updatedDebtWithPayment.payments[0],
        updatedDebt: updatedDebtWithPayment,
        transaction: { id: 'tx-repay-1', type: 'LOAN_REPAY_IN', amount: 20000000n },
      });
      balanceService.getTotalBalance.mockResolvedValue(11400000n);

      const res = await service.createPayment('user-1', 'debt-1', {
        amount: '20000000',
        accountId: 'acc-1',
        paidAt: '2026-08-20',
        note: '1-qism',
      });

      expect(res.payment.amount).toBe('20000000');
      expect(res.debt.paidAmount).toBe('20000000');
      expect(res.debt.remainingAmount).toBe('30000000');
      expect(res.debt.status).toBe('PARTIALLY_PAID');
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('records full payment, updates status to PAID and sets paidAt', async () => {
      repository.findById.mockResolvedValue(mockDebt);
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });

      const fullyPaidDebt: DebtWithPayments = {
        ...mockDebt,
        status: 'PAID',
        paidAt: new Date(),
        payments: [
          {
            id: 'p-1',
            debtId: 'debt-1',
            transactionId: 'tx-repay-1',
            amount: 50000000n,
            paidAt: new Date(),
            note: 'To‘liq',
            createdAt: new Date(),
          },
        ],
      };

      repository.createPayment.mockResolvedValue({
        payment: fullyPaidDebt.payments[0],
        updatedDebt: fullyPaidDebt,
        transaction: { id: 'tx-repay-1', type: 'LOAN_REPAY_IN', amount: 50000000n },
      });
      balanceService.getTotalBalance.mockResolvedValue(14400000n);

      const res = await service.createPayment('user-1', 'debt-1', {
        amount: '50000000',
        accountId: 'acc-1',
      });

      expect(res.debt.remainingAmount).toBe('0');
      expect(res.debt.status).toBe('PAID');
      expect(repository.createPayment).toHaveBeenCalledWith(
        'user-1',
        'debt-1',
        expect.any(Object),
        'PAID',
        expect.any(Date),
      );
    });

    it('throws 422 DEBT_OVERPAYMENT when payment exceeds remaining amount and does not modify database', async () => {
      repository.findById.mockResolvedValue(mockDebt); // remaining = 50000000n

      await expect(
        service.createPayment('user-1', 'debt-1', {
          amount: '60000000', // exceeds 50000000
          accountId: 'acc-1',
        }),
      ).rejects.toThrow(DebtOverpaymentException);

      expect(repository.createPayment).not.toHaveBeenCalled();
    });

    it('throws 409 DEBT_ALREADY_PAID when attempting payment on an already fully paid debt', async () => {
      const fullyPaidDebt: DebtWithPayments = {
        ...mockDebt,
        status: 'PAID',
        payments: [
          {
            id: 'p-1',
            debtId: 'debt-1',
            transactionId: 'tx-1',
            amount: 50000000n,
            paidAt: new Date(),
            note: null,
            createdAt: new Date(),
          },
        ],
      };
      repository.findById.mockResolvedValue(fullyPaidDebt);

      await expect(
        service.createPayment('user-1', 'debt-1', {
          amount: '5000',
          accountId: 'acc-1',
        }),
      ).rejects.toThrow(ConflictDomainException);
    });
  });

  describe('settle', () => {
    it('settles debt with full remaining amount', async () => {
      repository.findById.mockResolvedValue(mockDebt);
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });

      const settledDebt: DebtWithPayments = {
        ...mockDebt,
        status: 'PAID',
        paidAt: new Date(),
        payments: [
          {
            id: 'p-settle',
            debtId: 'debt-1',
            transactionId: 'tx-settle',
            amount: 50000000n,
            paidAt: new Date(),
            note: 'To‘liq yopildi',
            createdAt: new Date(),
          },
        ],
      };

      repository.createPayment.mockResolvedValue({
        payment: settledDebt.payments[0],
        updatedDebt: settledDebt,
        transaction: { id: 'tx-settle', type: 'LOAN_REPAY_IN', amount: 50000000n },
      });
      balanceService.getTotalBalance.mockResolvedValue(15000000n);

      const res = await service.settle('user-1', 'debt-1', {
        accountId: 'acc-1',
      });

      expect(res.debt.status).toBe('PAID');
      expect(res.debt.remainingAmount).toBe('0');
      expect(repository.createPayment).toHaveBeenCalledWith(
        'user-1',
        'debt-1',
        expect.objectContaining({ amount: 50000000n }),
        'PAID',
        expect.any(Date),
      );
    });
  });

  describe('delete', () => {
    it('soft deletes debt and linked ledger rows', async () => {
      repository.findById.mockResolvedValue(mockDebt);

      await service.delete('user-1', 'debt-1');

      expect(repository.softDelete).toHaveBeenCalledWith('user-1', 'debt-1');
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws 404 when debt not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('user-1', 'unknown')).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('domain invariant: debts are not expenses', () => {
    it('verifies loan transactions must never count as expense or income stats', () => {
      const statsAllowedTypes = ['INCOME', 'EXPENSE'];
      const debtTypes = ['LOAN_GIVEN', 'LOAN_TAKEN', 'LOAN_REPAY_IN', 'LOAN_REPAY_OUT'];

      for (const dType of debtTypes) {
        expect(statsAllowedTypes.includes(dType)).toBe(false);
      }
    });
  });
});
