import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtRemindersService } from './debt-reminders.service';
import { DebtRemindersProcessor } from './debt-reminders.processor';
import { DebtsRepository } from './debts.repository';
import { AccountsModule } from '../accounts/accounts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUES } from '../../infra/queue/queues';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.DEBT_REMINDERS }), AccountsModule, NotificationsModule],
  controllers: [DebtsController],
  providers: [DebtsService, DebtPaymentsService, DebtRemindersService, DebtRemindersProcessor, DebtsRepository],
  exports: [DebtsService, DebtPaymentsService, DebtRemindersService, DebtsRepository],
})
export class DebtsModule {}
