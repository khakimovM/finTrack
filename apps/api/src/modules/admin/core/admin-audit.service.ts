import { Injectable, Logger } from '@nestjs/common';
import { AdminAuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

export interface AdminAuditEntry {
  action: AdminAuditAction;
  /** Null when someone who is not an admin was refused. */
  adminUserId?: string | null;
  targetUserId?: string | null;
  telegramId?: bigint | null;
  meta?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/** Append-only record of the admin panel: sign-ins, refusals and every change an admin makes. */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AdminAuditEntry): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          action: entry.action,
          adminUserId: entry.adminUserId ?? null,
          targetUserId: entry.targetUserId ?? null,
          telegramId: entry.telegramId ?? null,
          meta: entry.meta,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (err) {
      // The audit must never be the reason a sign-in or an action fails; the log line keeps the trace.
      this.logger.error(`Admin audit write failed (${entry.action}): ${String(err)}`);
    }
  }
}
