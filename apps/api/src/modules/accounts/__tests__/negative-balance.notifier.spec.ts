import { NegativeBalanceNotifier } from '../negative-balance.notifier';
import { AccountsRepository } from '../accounts.repository';
import { BalanceService } from '../balance.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ClockService } from '../../../infra/clock/clock.service';

function setup(balances: Map<string, bigint>) {
  const accounts = { findById: jest.fn(async (_u: string, id: string) => ({ id, name: `Hisob ${id}` })) };
  const balanceService = {
    getAccountBalances: jest.fn().mockResolvedValue({ balances, total: 0n }),
    onLedgerCommitted: jest.fn(),
  };
  const notifications = { createSafe: jest.fn() };
  const clock = { todayFor: jest.fn().mockResolvedValue('2026-09-27') };
  const notifier = new NegativeBalanceNotifier(
    accounts as unknown as AccountsRepository,
    balanceService as unknown as BalanceService,
    notifications as unknown as NotificationsService,
    clock as unknown as ClockService,
  );
  return { notifier, balanceService, notifications };
}

describe('NegativeBalanceNotifier', () => {
  it('alerts only for touched accounts that are below zero, once per account per day', async () => {
    const t = setup(
      new Map([
        ['a', -150n],
        ['b', 500n],
      ]),
    );

    await t.notifier.check('u1', ['a', 'b', 'a']);

    expect(t.notifications.createSafe).toHaveBeenCalledTimes(1);
    expect(t.notifications.createSafe).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ type: 'NEGATIVE_BALANCE', dedupeKey: 'negative-balance:a:2026-09-27' }),
    );
  });

  it('subscribes to committed ledger writes', () => {
    const t = setup(new Map());
    t.notifier.onModuleInit();
    expect(t.balanceService.onLedgerCommitted).toHaveBeenCalledWith(expect.any(Function));
  });

  it('never throws', async () => {
    const t = setup(new Map());
    t.balanceService.getAccountBalances.mockRejectedValue(new Error('redis down'));
    await expect(t.notifier.check('u1', ['a'])).resolves.toBeUndefined();
  });
});
