import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DebtRemindersService, ReminderSummary } from './debt-reminders.service';
import { JOBS, QUEUES } from '../../infra/queue/queues';

@Processor(QUEUES.DEBT_REMINDERS)
export class DebtRemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(DebtRemindersProcessor.name);

  constructor(private readonly reminders: DebtRemindersService) {
    super();
  }

  async process(job: Job): Promise<ReminderSummary | null> {
    if (job.name !== JOBS.SEND_DEBT_REMINDERS) return null;
    const summary = await this.reminders.run();
    this.logger.log(`Debt reminders: ${JSON.stringify(summary)}`);
    return summary;
  }
}
