import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DailyDigestService, DigestSummary } from './daily-digest.service';
import { JOBS, QUEUES } from '../../../infra/queue/queues';

@Processor(QUEUES.DAILY_DIGEST)
export class DailyDigestProcessor extends WorkerHost {
  private readonly logger = new Logger(DailyDigestProcessor.name);

  constructor(private readonly digest: DailyDigestService) {
    super();
  }

  async process(job: Job): Promise<DigestSummary | null> {
    if (job.name !== JOBS.SEND_DAILY_DIGEST) return null;
    const summary = await this.digest.run();
    this.logger.log(`Daily digest: ${JSON.stringify(summary)}`);
    return summary;
  }
}
