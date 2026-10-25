import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MonthlyReportService, MonthlySummary } from './monthly-report.service';
import { JOBS, QUEUES } from '../../../infra/queue/queues';

@Processor(QUEUES.MONTHLY_REPORT)
export class MonthlyReportProcessor extends WorkerHost {
  private readonly logger = new Logger(MonthlyReportProcessor.name);

  constructor(private readonly reports: MonthlyReportService) {
    super();
  }

  async process(job: Job): Promise<MonthlySummary | null> {
    if (job.name !== JOBS.SEND_MONTHLY_REPORT) return null;
    const summary = await this.reports.run();
    this.logger.log(`Monthly report: ${JSON.stringify(summary)}`);
    return summary;
  }
}
