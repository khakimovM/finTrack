import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RecurringRunnerService, ProcessSummary } from './recurring-runner.service';
import { JOBS, QUEUES } from '../../infra/queue/queues';

@Processor(QUEUES.RECURRING)
export class RecurringProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurringProcessor.name);

  constructor(private readonly runner: RecurringRunnerService) {
    super();
  }

  async process(job: Job): Promise<ProcessSummary | null> {
    if (job.name !== JOBS.PROCESS_DUE_RULES) return null;
    const summary = await this.runner.processDueRules();
    this.logger.log(`Recurring run: ${JSON.stringify(summary)}`);
    return summary;
  }
}
