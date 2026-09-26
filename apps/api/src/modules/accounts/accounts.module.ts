import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';
import { AccountAccessService } from './account-access.service';
import { BalanceService } from './balance.service';
import { BalanceGuardService } from './balance-guard.service';
import { BalanceRepository } from './balance.repository';

@Module({
  controllers: [AccountsController],
  providers: [
    AccountsService,
    AccountsRepository,
    AccountAccessService,
    BalanceRepository,
    BalanceService,
    BalanceGuardService,
  ],
  exports: [AccountsService, AccountsRepository, AccountAccessService, BalanceService, BalanceGuardService],
})
export class AccountsModule {}
