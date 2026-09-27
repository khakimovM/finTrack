import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service';
import { QUEUES } from '../../infra/queue/queues';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.RECURRING }, { name: QUEUES.DEBT_REMINDERS }),
  ],
  providers: [SchedulerService],
})
export class JobsModule {}
