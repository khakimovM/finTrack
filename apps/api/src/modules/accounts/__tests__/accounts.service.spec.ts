import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts.service';
import { AccountsRepository, AccountWithCount } from '../accounts.repository';
import { BalanceService } from '../balance.service';
import {
  NotFoundDomainException,
  ConflictDomainException,
} from '../../../common/exceptions/domain.exception';

describe('AccountsService', () => {
  let service: AccountsService;
  let repository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    findByName: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    archive: jest.Mock;
    reorder: jest.Mock;
  };
  let balanceService: {
    getAccountBalances: jest.Mock;
    getBalance: jest.Mock;
    invalidate: jest.Mock;
  };

  const mockAccount: AccountWithCount = {
    id: 'acc-1',
    userId: 'user-1',
    name: 'Asosiy hisob',
    type: 'CASH',
    currency: 'UZS',
    openingBalance: 100000n,
    icon: '💵',
    color: '#10b981',
    isDefault: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    deletedAt: null,
    _count: { transactions: 5 },
  };

  beforeEach(async () => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      archive: jest.fn(),
      reorder: jest.fn(),
    };
    balanceService = {
      getAccountBalances: jest.fn(),
      getBalance: jest.fn(),
      invalidate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: AccountsRepository, useValue: repository },
        { provide: BalanceService, useValue: balanceService },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    it('returns accounts with computed balance and meta.totalBalance', async () => {
      repository.findAll.mockResolvedValue([mockAccount]);
      balanceService.getAccountBalances.mockResolvedValue({
        balances: new Map([['acc-1', 150000n]]),
        total: 150000n,
      });

      const res = await service.list('user-1');

      expect(res.data).toHaveLength(1);
      expect(res.data[0].balance).toBe('150000');
      expect(res.data[0].openingBalance).toBe('100000');
      expect(res.data[0].transactionCount).toBe(5);
      expect(res.meta.totalBalance).toBe('150000');
    });
  });

  describe('getById', () => {
    it('returns account by ID with balance', async () => {
      repository.findById.mockResolvedValue(mockAccount);
      balanceService.getBalance.mockResolvedValue(150000n);

      const res = await service.getById('user-1', 'acc-1');

      expect(res.id).toBe('acc-1');
      expect(res.balance).toBe('150000');
    });

    it('throws NotFoundDomainException (404) if account not found or not owner', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('user-1', 'other-acc')).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('create', () => {
    it('creates account and invalidates balance cache', async () => {
      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...mockAccount,
        id: 'acc-new',
        name: 'Humo',
        openingBalance: 50000n,
      });

      const res = await service.create('user-1', {
        name: 'Humo',
        type: 'CARD',
        openingBalance: '50000',
        color: '#6366f1',
        icon: '💳',
        currency: 'UZS',
        isDefault: false,
      });

      expect(res.name).toBe('Humo');
      expect(res.balance).toBe('50000');
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });

    it('throws ConflictDomainException (409) if name already taken', async () => {
      repository.findByName.mockResolvedValue(mockAccount);

      await expect(
        service.create('user-1', {
          name: 'Asosiy hisob',
          type: 'CASH',
          currency: 'UZS',
          openingBalance: '0',
          color: '#6366f1',
          icon: '💳',
          isDefault: false,
        }),
      ).rejects.toThrow(ConflictDomainException);
    });
  });

  describe('update', () => {
    it('updates account and invalidates cache if openingBalance changed', async () => {
      repository.findById.mockResolvedValue(mockAccount);
      repository.update.mockResolvedValue({
        ...mockAccount,
        openingBalance: 200000n,
      });
      balanceService.getBalance.mockResolvedValue(250000n);

      const res = await service.update('user-1', 'acc-1', {
        openingBalance: '200000',
      });

      expect(res.balance).toBe('250000');
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });
  });

  describe('toggleArchive', () => {
    it('toggles archive status', async () => {
      repository.findById.mockResolvedValue(mockAccount);
      const archivedDate = new Date();
      repository.archive.mockResolvedValue({
        ...mockAccount,
        archivedAt: archivedDate,
      });
      balanceService.getBalance.mockResolvedValue(100000n);

      const res = await service.toggleArchive('user-1', 'acc-1');
      expect(res.archivedAt).toBe(archivedDate.toISOString());
    });
  });

  describe('delete', () => {
    it('soft deletes account and invalidates balance cache', async () => {
      repository.findById.mockResolvedValue(mockAccount);
      repository.softDelete.mockResolvedValue(mockAccount);

      await service.delete('user-1', 'acc-1');

      expect(repository.softDelete).toHaveBeenCalledWith('user-1', 'acc-1');
      expect(balanceService.invalidate).toHaveBeenCalledWith('user-1');
    });
  });
});
