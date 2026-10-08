import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCoreModule } from './core/admin-core.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminCookiesService } from './admin-cookies.service';
import { AdminGuard } from './admin.guard';
import { AdminSessionService } from './admin-session.service';

/**
 * The owner's admin panel (docs/09-ADMIN-PANEL.md). The only module allowed to read across
 * users; it reads counts and dates, never amounts or free text.
 */
@Module({
  imports: [AuthModule, AdminCoreModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminSessionService, AdminCookiesService, AdminGuard],
})
export class AdminModule {}
