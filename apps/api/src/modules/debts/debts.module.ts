import { Module } from '@nestjs/common';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtsRepository } from './debts.repository';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule],
  controllers: [DebtsController],
  providers: [DebtsService, DebtPaymentsService, DebtsRepository],
  exports: [DebtsService, DebtPaymentsService, DebtsRepository],
})
export class DebtsModule {}
