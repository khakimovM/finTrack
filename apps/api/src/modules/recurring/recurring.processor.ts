import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RecurringService } from './recurring.service';

export const RECURRING_QUEUE_NAME = 'recurring';

@Processor(RECURRING_QUEUE_NAME)
export class RecurringProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringProcessor.name);

  constructor(private readonly recurringService: RecurringService) {
    super();
  }

  async process(job: Job): Promise<{ processed: number; skipped: number; errors: number }> {
    this.logger.log(`Processing job ${job.name} (id: ${job.id})`);
    if (job.name === 'process-due-rules') {
      const result = await this.recurringService.processDueRules();
      this.logger.log(`Recurring rules processed: ${JSON.stringify(result)}`);
      return result;
    }
    return { processed: 0, skipped: 0, errors: 0 };
  }
}
