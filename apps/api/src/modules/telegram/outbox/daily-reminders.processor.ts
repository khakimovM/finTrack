import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DailyRemindersService, ReminderSummary } from './daily-reminders.service';
import { JOBS, QUEUES } from '../../../infra/queue/queues';

const KIND = {
  [JOBS.SEND_MORNING_REMINDERS]: 'morning',
  [JOBS.SEND_EVENING_REMINDERS]: 'evening',
} as const;

@Processor(QUEUES.DAILY_REMINDERS)
export class DailyRemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(DailyRemindersProcessor.name);

  constructor(private readonly reminders: DailyRemindersService) {
    super();
  }

  async process(job: Job): Promise<ReminderSummary | null> {
    const kind = KIND[job.name as keyof typeof KIND];
    if (!kind) return null;
    const summary = await this.reminders.run(kind);
    this.logger.log(`Daily reminders: ${JSON.stringify(summary)}`);
    return summary;
  }
}
