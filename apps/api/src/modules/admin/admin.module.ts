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

/**
 * The owner's admin panel (docs/09-ADMIN-PANEL.md). The only module allowed to read across
 * users; it reads counts and dates, never amounts or free text.
 */
@Module({
  imports: [
    AuthModule,
    AdminCoreModule,
    // Read-only here: the system page shows their counts and latest failures.
    BullModule.registerQueue(
      { name: QUEUES.RECURRING },
      { name: QUEUES.DEBT_REMINDERS },
      { name: QUEUES.TELEGRAM_OUTBOX },
      { name: QUEUES.DAILY_DIGEST },
    ),
  ],
  controllers: [AdminAuthController, AdminStatsController, AdminUsersController, AdminSystemController],
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
  ],
})
export class AdminModule {}
