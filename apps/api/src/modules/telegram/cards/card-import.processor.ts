import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CardIntakeService } from './card-intake.service';
import { JOBS, QUEUES } from '../../../infra/queue/queues';

/** Runs once a burst of forwarded card notifications has gone quiet. */
@Processor(QUEUES.CARD_IMPORT)
export class CardImportProcessor extends WorkerHost {
  constructor(private readonly intake: CardIntakeService) {
    super();
  }

  async process(job: Job<{ userId: string }>): Promise<string | null> {
    if (job.name !== JOBS.FLUSH_CARD_IMPORT) return null;
    return this.intake.flush(job.data.userId);
  }
}
