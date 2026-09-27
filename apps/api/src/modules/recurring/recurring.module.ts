import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { RecurringRunnerService } from './recurring-runner.service';
import { RecurringRepository } from './recurring.repository';
import { RecurringProcessor } from './recurring.processor';
import { AccountsModule } from '../accounts/accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUES } from '../../infra/queue/queues';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.RECURRING }),
    AccountsModule,
    CategoriesModule,
    BudgetsModule,
    NotificationsModule,
  ],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringRunnerService, RecurringRepository, RecurringProcessor],
  exports: [RecurringService, RecurringRunnerService],
})
export class RecurringModule {}
