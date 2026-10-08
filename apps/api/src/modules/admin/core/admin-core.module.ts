import { Module } from '@nestjs/common';
import { AdminAccessService } from './admin-access.service';
import { AdminAuditService } from './admin-audit.service';

/** What the auth module and the bot need from the admin panel, without depending on it. */
@Module({
  providers: [AdminAccessService, AdminAuditService],
  exports: [AdminAccessService, AdminAuditService],
})
export class AdminCoreModule {}
