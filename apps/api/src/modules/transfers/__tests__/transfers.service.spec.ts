import { Test, TestingModule } from '@nestjs/testing';
import { TransfersService } from '../transfers.service';
import { TransfersRepository } from '../transfers.repository';
import { AccountsRepository } from '../../accounts/accounts.repository';
import { BalanceService } from '../../accounts/balance.service';
import { BalanceGuardService } from '../../accounts/balance-guard.service';
import {
  NotFoundDomainException,
  SameAccountTransferException,
  FutureDateException,
  InsufficientBalanceException,
} from '../../../common/exceptions/domain.exception';

describe('TransfersService', () => {
  let service: TransfersService;
  let repository: {
    createTransfer: jest.Mock;
    deleteTransfer: jest.Mock;
  };
  let accountsRepository: { findById: jest.Mock };
  let balanceService: {
    getBalance: jest.Mock;
    getTotalBalance: jest.Mock;
    invalidate: jest.Mock;
  };
  let balanceGuardService: { assertSufficient: jest.Mock };

  beforeEach(async () => {
    repository = {
      createTransfer: jest.fn(),
      deleteTransfer: jest.fn(),
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
        TransfersService,
        { provide: TransfersRepository, useValue: repository },
        { provide: AccountsRepository, useValue: accountsRepository },
        { provide: BalanceService, useValue: balanceService },
        { provide: BalanceGuardService, useValue: balanceGuardService },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const validDto = {
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: '500000',
      date: '2026-08-15',
      note: 'O‘tkazma',
    };

    it('creates transfer with two ledger rows and does not alter total balance', async () => {
      accountsRepository.findById.mockImplementation((userId, id) => {
        if (id === 'acc-1') return Promise.resolve({ id: 'acc-1', name: 'Humo' });
        if (id === 'acc-2') return Promise.resolve({ id: 'acc-2', name: 'Uzcard' });
        return Promise.resolve(null);
      });

      balanceGuardService.assertSufficient.mockResolvedValue(undefined);

      repository.createTransfer.mockResolvedValue({
        transferGroupId: 'tg_123',
        outTx: { id: 'tx-out', type: 'TRANSFER_OUT', accountId: 'acc-1', amount: 500000n },
        inTx: { id: 'tx-in', type: 'TRANSFER_IN', accountId: 'acc-2', amount: 500000n },
      });

      balanceService.getBalance.mockImplementation((userId, accId) => {
        if (accId === 'acc-1') return Promise.resolve(500000n);
        if (accId === 'acc-2') return Promise.resolve(1500000n);
        return Promise.resolve(0n);
      });
      balanceService.getTotalBalance.mockResolvedValue(2000000n);

      const res = await service.create('user-1', validDto);

      expect(res.transferGroupId).toBe('tg_123');
      expect(res.out.type).toBe('TRANSFER_OUT');
      expect(res.in.type).toBe('TRANSFER_IN');
      expect(res.balances['acc-1']).toBe('500000');
      expect(res.balances['acc-2']).toBe('1500000');
      expect(res.balances.total).toBe('2000000');

      expect(balanceGuardService.assertSufficient).toHaveBeenCalledWith('user-1', 'acc-1', 500000n);
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws 422 SAME_ACCOUNT_TRANSFER when fromAccountId === toAccountId', async () => {
      await expect(
        service.create('user-1', {
          ...validDto,
          toAccountId: 'acc-1',
        }),
      ).rejects.toThrow(SameAccountTransferException);
    });

    it('throws 422 FUTURE_DATE when date is in the future', async () => {
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

    it('throws 404 when either account does not exist or not owned', async () => {
      accountsRepository.findById.mockImplementation((userId, id) => {
        if (id === 'acc-1') return Promise.resolve({ id: 'acc-1' });
        return Promise.resolve(null);
      });

      await expect(service.create('user-1', validDto)).rejects.toThrow(NotFoundDomainException);
    });

    it('throws 422 INSUFFICIENT_BALANCE when source balance is insufficient in strictMode', async () => {
      accountsRepository.findById.mockResolvedValue({ id: 'acc-1' });
      balanceGuardService.assertSufficient.mockRejectedValue(
        new InsufficientBalanceException('Balansingiz yetarli emas'),
      );

      await expect(service.create('user-1', validDto)).rejects.toThrow(InsufficientBalanceException);
      expect(repository.createTransfer).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes transfer and invalidates cache', async () => {
      repository.deleteTransfer.mockResolvedValue(2);

      await service.delete('user-1', 'tg_123');

      expect(repository.deleteTransfer).toHaveBeenCalledWith('user-1', 'tg_123');
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws 404 when transfer group ID is not found', async () => {
      repository.deleteTransfer.mockResolvedValue(0);

      await expect(service.delete('user-1', 'tg_unknown')).rejects.toThrow(NotFoundDomainException);
    });
  });
});
