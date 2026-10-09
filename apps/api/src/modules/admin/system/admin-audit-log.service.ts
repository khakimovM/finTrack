import { Injectable } from '@nestjs/common';
import { AdminAuditQuery, AdminAuditResponse } from '@fintrack/shared';
import { PrismaService } from '../../../infra/prisma/prisma.service';

/** Reads the admin audit log, newest first, with the names of the people it mentions. */
@Injectable()
export class AdminAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminAuditQuery): Promise<AdminAuditResponse> {
    const where = query.action ? { action: query.action } : {};
    const [total, rows] = await Promise.all([
      this.prisma.adminAuditLog.count({ where }),
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    // No foreign keys (the log outlives accounts), so names are looked up; a missing one stays null.
    const ids = [...new Set(rows.flatMap((r) => [r.adminUserId, r.targetUserId]).filter((id): id is string => id !== null))];
    const people = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const nameOf = new Map(people.map((p) => [p.id, p.name]));

    return {
      data: rows.map((r) => ({
        id: r.id,
        action: r.action,
        createdAt: r.createdAt.toISOString(),
        admin: r.adminUserId ? { id: r.adminUserId, name: nameOf.get(r.adminUserId) ?? '—' } : null,
        target: r.targetUserId ? { id: r.targetUserId, name: nameOf.get(r.targetUserId) ?? null } : null,
        telegramId: r.telegramId?.toString() ?? null,
        meta: r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta) ? (r.meta as Record<string, unknown>) : null,
        ipAddress: r.ipAddress,
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) || 1 },
    };
  }
}
