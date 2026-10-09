import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JOBS, QUEUES } from '../../../infra/queue/queues';
import { BroadcastDeliveryService } from './broadcast-delivery.service';

/**
 * One job per broadcast; the job paces itself. A crashed or stalled job is run again by BullMQ and
 * carries on with whoever is still waiting.
 */
@Processor(QUEUES.BROADCAST)
export class BroadcastProcessor extends WorkerHost {
  constructor(private readonly delivery: BroadcastDeliveryService) {
    super();
  }

  async process(job: Job<{ broadcastId: string }>): Promise<void> {
    if (job.name !== JOBS.DELIVER_BROADCAST) return;
    await this.delivery.deliver(job.data.broadcastId);
  }
}
