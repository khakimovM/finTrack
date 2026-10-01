import { Account } from '@prisma/client';
import { AccountsService } from '../accounts.service';
import { AccountsRepository, AccountWithCount } from '../accounts.repository';
import { BalanceService } from '../balance.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../../../common/exceptions/domain.exception';

const USER = 'user-1';
const ID = '11111111-1111-1111-1111-111111111111';

function account(overrides: Partial<Account> = {}): AccountWithCount {
  return {
    id: ID,
    userId: USER,
    name: 'Humo karta',
    type: 'CARD',
    currency: 'UZS',
    openingBalance: 0n,
    icon: '💳',
    color: '#6366f1',
    isDefault: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    deletedAt: null,
    _count: { transactions: 3 },
    ...overrides,
  };
}

function setup() {
  const repository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn().mockResolvedValue(null),
    countActive: jest.fn().mockResolvedValue(2),
    hasHistory: jest.fn().mockResolvedValue(false),
    create: jest.fn(),
    update: jest.fn(),
    hardDelete: jest.fn(),
    setArchived: jest.fn(),
    reorder: jest.fn(),
  };
  const balanceService = {
    getAccountBalances: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(12_550_000n),
    invalidate: jest.fn(),
  };
  const service = new AccountsService(
    repository as unknown as AccountsRepository,
    balanceService as unknown as BalanceService,
  );
  return { service, repository, balanceService };
}

describe('AccountsService', () => {
  it('lists accounts with ledger-derived balances and meta.totalBalance', async () => {
    const t = setup();
    t.repository.findAll.mockResolvedValue([account()]);
    t.balanceService.getAccountBalances.mockResolvedValue({
      balances: new Map([[ID, 12_550_000n]]),
      total: 18_900_000n,
    });

    const res = await t.service.list(USER);

    expect(res.data[0]).toMatchObject({ balance: '12550000', openingBalance: '0', transactionCount: 3 });
    expect(res.meta.totalBalance).toBe('18900000');
  });

  it('creates an account and invalidates the balance cache', async () => {
    const t = setup();
    t.repository.create.mockResolvedValue(account({ openingBalance: 500n }));

    const res = await t.service.create(USER, {
      name: 'Humo karta',
      type: 'CARD',
      currency: 'UZS',
      openingBalance: '500',
      icon: '💳',
      color: '#6366f1',
      isDefault: false,
    });

    expect(res.balance).toBe('500');
    expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER);
  });

  it('rejects a duplicate name with 409 ACCOUNT_EXISTS', async () => {
    const t = setup();
    t.repository.findByName.mockResolvedValue(account({ id: 'other' }));
    await expect(
      t.service.create(USER, {
        name: 'humo karta',
        type: 'CARD',
        currency: 'UZS',
        openingBalance: '0',
        icon: '💳',
        color: '#6366f1',
        isDefault: false,
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_EXISTS' });
  });

  it('returns 404 for someone else’s account', async () => {
    const t = setup();
    t.repository.findById.mockResolvedValue(null);
    await expect(t.service.getById(USER, ID)).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  describe('delete', () => {
    it('refuses to delete an account with history (409 ACCOUNT_HAS_HISTORY)', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(account());
      t.repository.hasHistory.mockResolvedValue(true);

      await expect(t.service.delete(USER, ID)).rejects.toBeInstanceOf(ConflictDomainException);
      expect(t.repository.hardDelete).not.toHaveBeenCalled();
    });

    it('refuses to delete the last active account', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(account());
      t.repository.countActive.mockResolvedValue(1);

      await expect(t.service.delete(USER, ID)).rejects.toMatchObject({ code: 'LAST_ACCOUNT' });
    });

    it('hard-deletes an empty account', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(account({ _count: { transactions: 0 } } as Partial<Account>));

      await t.service.delete(USER, ID);

      expect(t.repository.hardDelete).toHaveBeenCalledWith(USER, ID);
      expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER);
    });
  });

  describe('toggleArchive', () => {
    it('archives an active account', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(account());
      t.repository.setArchived.mockResolvedValue(account({ archivedAt: new Date(), isDefault: false }));

      const res = await t.service.toggleArchive(USER, ID);

      expect(t.repository.setArchived).toHaveBeenCalledWith(USER, ID, expect.any(Date));
      expect(res.archivedAt).not.toBeNull();
    });

    it('refuses to archive the last active account', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(account());
      t.repository.countActive.mockResolvedValue(1);

      await expect(t.service.toggleArchive(USER, ID)).rejects.toMatchObject({ code: 'LAST_ACCOUNT' });
    });

    it('unarchives without the last-account check', async () => {
      const t = setup();
      t.repository.findById.mockResolvedValue(account({ archivedAt: new Date() }));
      t.repository.countActive.mockResolvedValue(0);
      t.repository.setArchived.mockResolvedValue(account());

      await t.service.toggleArchive(USER, ID);
      expect(t.repository.setArchived).toHaveBeenCalledWith(USER, ID, null);
    });
  });
});
