import { Global, Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { DailyMetricsService } from './daily-metrics.service';

/**
 * Global: the auth guard, the bot and the assistant all report usage, from opposite ends of
 * the app, for the admin panel to read.
 */
@Global()
@Module({
  providers: [ActivityService, DailyMetricsService],
  exports: [ActivityService, DailyMetricsService],
})
export class ActivityModule {}
