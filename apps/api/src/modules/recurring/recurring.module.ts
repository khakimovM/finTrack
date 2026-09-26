import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { RecurringRepository } from './recurring.repository';
import { RecurringProcessor, RECURRING_QUEUE_NAME } from './recurring.processor';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: RECURRING_QUEUE_NAME,
    }),
    AccountsModule,
    CategoriesModule,
    BudgetsModule,
  ],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringRepository, RecurringProcessor],
  exports: [RecurringService, RecurringRepository],
})
export class RecurringModule {}
