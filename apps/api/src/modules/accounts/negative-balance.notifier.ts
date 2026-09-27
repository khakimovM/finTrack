import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { formatMoney } from '@fintrack/shared';
import { AccountsRepository } from './accounts.repository';
import { BalanceService } from './balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClockService } from '../../infra/clock/clock.service';

/**
 * Raises NEGATIVE_BALANCE after a committed write pushed an account below zero
 * (only possible with strict mode off). At most one alert per account per day.
 */
@Injectable()
export class NegativeBalanceNotifier implements OnModuleInit {
  private readonly logger = new Logger(NegativeBalanceNotifier.name);

  constructor(
    private readonly accounts: AccountsRepository,
    private readonly balances: BalanceService,
    private readonly notifications: NotificationsService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    this.balances.onLedgerCommitted((userId, accountIds) => this.check(userId, accountIds));
  }

  /** Never throws: an alert must not fail the operation that triggered it. */
  async check(userId: string, accountIds: Iterable<string>): Promise<void> {
    try {
      const ids = [...new Set(accountIds)];
      if (ids.length === 0) return;

      const { balances } = await this.balances.getAccountBalances(userId);
      const negative = ids.filter((id) => (balances.get(id) ?? 0n) < 0n);
      if (negative.length === 0) return;

      const today = await this.clock.todayFor(userId);
      for (const accountId of negative) {
        const account = await this.accounts.findById(userId, accountId);
        if (!account) continue;
        const balance = balances.get(accountId) ?? 0n;
        await this.notifications.createSafe(userId, {
          type: 'NEGATIVE_BALANCE',
          title: 'Hisob balansi manfiy',
          body: `"${account.name}" hisobida balans ${formatMoney(balance)} bo‘ldi.`,
          meta: { accountId, balance: balance.toString() },
          dedupeKey: `negative-balance:${accountId}:${today}`,
        });
      }
    } catch (err) {
      this.logger.error('Negative balance check failed', err);
    }
  }
}
