import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';
import { AccountAccessService } from './account-access.service';
import { BalanceService } from './balance.service';
import { BalanceGuardService } from './balance-guard.service';
import { BalanceRepository } from './balance.repository';
import { NegativeBalanceNotifier } from './negative-balance.notifier';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AccountsController],
  providers: [
    AccountsService,
    AccountsRepository,
    AccountAccessService,
    BalanceRepository,
    BalanceService,
    BalanceGuardService,
    NegativeBalanceNotifier,
  ],
  exports: [
    AccountsService,
    AccountsRepository,
    AccountAccessService,
    BalanceService,
    BalanceGuardService,
    NegativeBalanceNotifier,
  ],
})
export class AccountsModule {}
