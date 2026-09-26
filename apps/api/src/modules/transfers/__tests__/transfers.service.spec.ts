import { Transaction } from '@prisma/client';
import { TransfersService } from '../transfers.service';
import { TransfersRepository } from '../transfers.repository';
import { AccountAccessService } from '../../accounts/account-access.service';
import { BalanceService } from '../../accounts/balance.service';
import { BalanceGuardService } from '../../accounts/balance-guard.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { clockStub } from '../../../infra/clock/__tests__/clock.stub';
import { prismaStub } from '../../../infra/prisma/__tests__/prisma.stub';
import {
  FutureDateException,
  InsufficientBalanceException,
  NotFoundDomainException,
  SameAccountTransferException,
} from '../../../common/exceptions/domain.exception';

const USER = 'user-1';
const FROM = '11111111-1111-1111-1111-111111111111';
const TO = '22222222-2222-2222-2222-222222222222';

function leg(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'leg',
    userId: USER,
    accountId: FROM,
    type: 'TRANSFER_OUT',
    amount: 5_000_000n,
    amountBase: null,
    categoryId: null,
    debtId: null,
    transferGroupId: 'tg_1',
    recurringRuleId: null,
    date: new Date('2026-09-01T00:00:00Z'),
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function setup() {
  const repository = { createTransfer: jest.fn(), findLiveLegs: jest.fn(), softDeleteGroup: jest.fn() };
  const accountAccess = { assertWritable: jest.fn().mockResolvedValue(undefined) };
  const balanceService = {
    invalidate: jest.fn(),
    getAccountBalances: jest.fn().mockResolvedValue({
      balances: new Map([
        [FROM, 7_550_000n],
        [TO, 11_350_000n],
      ]),
      total: 18_900_000n,
    }),
  };
  const guard = { assertCanDebit: jest.fn(), assertDeltas: jest.fn() };
  const prisma = prismaStub();
  const service = new TransfersService(
    repository as unknown as TransfersRepository,
    accountAccess as unknown as AccountAccessService,
    balanceService as unknown as BalanceService,
    guard as unknown as BalanceGuardService,
    clockStub() as unknown as ClockService,
    prisma,
  );
  return { service, repository, accountAccess, balanceService, guard, prisma };
}

const dto = { fromAccountId: FROM, toAccountId: TO, amount: '5000000', date: '2026-09-01' };

describe('TransfersService', () => {
  it('writes both legs in one transaction after debit-checking the source', async () => {
    const t = setup();
    t.repository.createTransfer.mockResolvedValue({
      transferGroupId: 'tg_1',
      outTx: leg({ id: 'out' }),
      inTx: leg({ id: 'in', type: 'TRANSFER_IN', accountId: TO }),
    });

    const res = await t.service.create(USER, dto);

    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(t.guard.assertCanDebit).toHaveBeenCalledWith(t.prisma.tx, USER, FROM, 5_000_000n);
    expect(t.repository.createTransfer).toHaveBeenCalledWith(
      t.prisma.tx,
      USER,
      expect.objectContaining({ fromAccountId: FROM, toAccountId: TO, amount: 5_000_000n }),
    );
    expect(res.balances).toEqual({ [FROM]: '7550000', [TO]: '11350000', total: '18900000' });
    expect(res.out.type).toBe('TRANSFER_OUT');
    expect(res.in.type).toBe('TRANSFER_IN');
  });

  it('rejects a transfer to the same account', async () => {
    const t = setup();
    await expect(t.service.create(USER, { ...dto, toAccountId: FROM })).rejects.toBeInstanceOf(
      SameAccountTransferException,
    );
  });

  it('rejects a future date', async () => {
    const t = setup();
    await expect(t.service.create(USER, { ...dto, date: '2999-01-01' })).rejects.toBeInstanceOf(
      FutureDateException,
    );
  });

  it('writes nothing when strict mode refuses the debit', async () => {
    const t = setup();
    t.guard.assertCanDebit.mockRejectedValue(new InsufficientBalanceException());
    await expect(t.service.create(USER, dto)).rejects.toBeInstanceOf(InsufficientBalanceException);
    expect(t.repository.createTransfer).not.toHaveBeenCalled();
  });

  it('deleting reverses both legs and debit-checks the destination', async () => {
    const t = setup();
    t.repository.findLiveLegs.mockResolvedValue([
      leg({ id: 'out' }),
      leg({ id: 'in', type: 'TRANSFER_IN', accountId: TO }),
    ]);

    await t.service.delete(USER, 'tg_1');

    expect(t.guard.assertDeltas).toHaveBeenCalledWith(
      t.prisma.tx,
      USER,
      new Map([
        [FROM, 5_000_000n],
        [TO, -5_000_000n],
      ]),
    );
    expect(t.repository.softDeleteGroup).toHaveBeenCalledWith(t.prisma.tx, USER, 'tg_1');
    expect(t.balanceService.invalidate).toHaveBeenCalledWith(USER);
  });

  it('returns 404 for an unknown or foreign transfer group', async () => {
    const t = setup();
    t.repository.findLiveLegs.mockResolvedValue([]);
    await expect(t.service.delete(USER, 'tg_x')).rejects.toBeInstanceOf(NotFoundDomainException);
  });
});
