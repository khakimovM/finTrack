import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';
import { BalanceService } from './balance.service';
import { BalanceGuardService } from './balance-guard.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountsRepository, BalanceService, BalanceGuardService],
  exports: [AccountsService, AccountsRepository, BalanceService, BalanceGuardService],
})
export class AccountsModule {}
