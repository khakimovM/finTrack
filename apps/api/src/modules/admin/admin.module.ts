import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../../infra/queue/queues';
import { AuthModule } from '../auth/auth.module';
import { AdminCoreModule } from './core/admin-core.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminCookiesService } from './admin-cookies.service';
import { AdminGuard } from './admin.guard';
import { AdminSessionService } from './admin-session.service';
import { AdminStatsController } from './stats/admin-stats.controller';
import { AdminStatsRepository } from './stats/admin-stats.repository';
import { AdminStatsService } from './stats/admin-stats.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersRepository } from './users/admin-users.repository';
import { AdminUsersService } from './users/admin-users.service';
import { AdminSystemController } from './system/admin-system.controller';
import { AdminSystemService } from './system/admin-system.service';
import { AdminAuditLogService } from './system/admin-audit-log.service';
import { BroadcastsController } from './broadcasts/broadcasts.controller';
import { BroadcastsService } from './broadcasts/broadcasts.service';
import { BroadcastsRepository } from './broadcasts/broadcasts.repository';
import { BroadcastDeliveryService } from './broadcasts/broadcast-delivery.service';
import { BroadcastProcessor } from './broadcasts/broadcast.processor';

/**
 * The owner's admin panel (docs/09-ADMIN-PANEL.md). The only module allowed to read across
 * users; it reads counts and dates, never amounts or free text.
 */
@Module({
  imports: [
    AuthModule,
    AdminCoreModule,
    // Broadcasts are this module's own queue; the others are only read by the system page.
    BullModule.registerQueue(
      { name: QUEUES.RECURRING },
      { name: QUEUES.DEBT_REMINDERS },
      { name: QUEUES.TELEGRAM_OUTBOX },
      { name: QUEUES.DAILY_DIGEST },
      { name: QUEUES.BROADCAST },
    ),
  ],
  controllers: [AdminAuthController, AdminStatsController, AdminUsersController, AdminSystemController, BroadcastsController],
  providers: [
    AdminAuthService,
    AdminSessionService,
    AdminCookiesService,
    AdminGuard,
    AdminStatsService,
    AdminStatsRepository,
    AdminUsersService,
    AdminUsersRepository,
    AdminSystemService,
    AdminAuditLogService,
    BroadcastsService,
    BroadcastsRepository,
    BroadcastDeliveryService,
    BroadcastProcessor,
  ],
})
export class AdminModule {}
