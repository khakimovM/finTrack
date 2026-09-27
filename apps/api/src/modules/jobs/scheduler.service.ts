import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, JOBS, QUEUES } from '../../infra/queue/queues';

/**
 * Registers the repeatable jobs. `upsertJobScheduler` is idempotent, so every API instance can
 * run this on boot without creating duplicate schedules.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.RECURRING) private readonly recurringQueue: Queue,
    @InjectQueue(QUEUES.DEBT_REMINDERS) private readonly remindersQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<boolean>('SCHEDULER_ENABLED') === false) {
      this.logger.log('Scheduler disabled (SCHEDULER_ENABLED=false)');
      return;
    }
    const tz = this.config.get<string>('APP_TIMEZONE', 'Asia/Tashkent');

    try {
      // Hourly, so users in any time zone get their occurrence shortly after their own midnight.
      await this.recurringQueue.upsertJobScheduler(
        'recurring-hourly',
        { pattern: '5 * * * *', tz },
        { name: JOBS.PROCESS_DUE_RULES, opts: DEFAULT_JOB_OPTIONS },
      );
      await this.remindersQueue.upsertJobScheduler(
        'debt-reminders-daily',
        { pattern: '0 9 * * *', tz },
        { name: JOBS.SEND_DEBT_REMINDERS, opts: DEFAULT_JOB_OPTIONS },
      );
      this.logger.log(`Job schedulers registered (tz=${tz})`);
    } catch (err: unknown) {
      // Redis being down must not keep the API from serving requests; the next boot retries.
      this.logger.error('Failed to register job schedulers', err instanceof Error ? err.stack : String(err));
    }
  }
}
