import { Injectable } from '@nestjs/common';
import { ActivityChannel, AdminAuditAction, Prisma, TransactionSource } from '@prisma/client';
import { AdminUserFilter, AdminUserSort, AdminUsersExportQuery } from '@fintrack/shared';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ENTRY } from '../core/admin-sql';

/**
 * People as the admin panel sees them: who they are (name, @username), when they came and how
 * much they use FinTrack, as counts. Like the statistics, a deliberate read across users
 * (docs/09); amounts, balances and notes are never selected.
 */

export interface AdminUserRecord {
  id: string;
  name: string;
  telegramUsername: string | null;
  telegramId: bigint | null;
  phone: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  bannedAt: Date | null;
  banReason: string | null;
  deletedAt: Date | null;
  telegramBlockedAt: Date | null;
  entries: number;
  accounts: number;
  channels: ActivityChannel[];
}

export interface AdminUserCounts {
  categories: number;
  debts: number;
  budgets: number;
  recurring: number;
  tags: number;
  activeSessions: number;
}

const ORDER: Record<AdminUserSort, Prisma.Sql> = {
  newest: Prisma.sql`u."created_at" DESC, u."id"`,
  oldest: Prisma.sql`u."created_at" ASC, u."id"`,
  lastSeen: Prisma.sql`u."last_seen_at" DESC NULLS LAST, u."id"`,
  entries: Prisma.sql`(SELECT COUNT(*) FROM "transactions" t WHERE t."user_id" = u."id" AND t."deleted_at" IS NULL AND ${ENTRY}) DESC, u."id"`,
  name: Prisma.sql`lower(u."name"), u."id"`,
};

const STATUS: Record<AdminUserFilter, Prisma.Sql> = {
  all: Prisma.sql`TRUE`,
  active: Prisma.sql`u."deleted_at" IS NULL AND u."banned_at" IS NULL`,
  banned: Prisma.sql`u."deleted_at" IS NULL AND u."banned_at" IS NOT NULL`,
  deleted: Prisma.sql`u."deleted_at" IS NOT NULL`,
  botBlocked: Prisma.sql`u."deleted_at" IS NULL AND u."telegram_blocked_at" IS NOT NULL`,
};

/** `%` and `_` typed into the search box are letters, not wildcards. */
const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

function where(query: AdminUsersExportQuery): Prisma.Sql {
  const q = query.q?.trim();
  if (!q) return STATUS[query.status];
  const like = `%${likeEscape(q.replace(/^@/, ''))}%`;
  const byTelegramId = /^\d{5,15}$/.test(q) ? Prisma.sql` OR u."telegram_id" = ${BigInt(q)}` : Prisma.empty;
  return Prisma.sql`${STATUS[query.status]} AND (u."name" ILIKE ${like} OR u."telegram_username" ILIKE ${like}${byTelegramId})`;
}

@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count(query: AdminUsersExportQuery): Promise<number> {
    const [row] = await this.prisma.$queryRaw<[{ n: number }]>`
      SELECT COUNT(*)::int AS "n" FROM "users" u WHERE ${where(query)}
    `;
    return row.n;
  }

  /** One page, in the asked order. Counts are worked out only for the rows on the page. */
  async page(query: AdminUsersExportQuery, offset: number, limit: number, since: string): Promise<AdminUserRecord[]> {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT u."id" FROM "users" u WHERE ${where(query)} ORDER BY ${ORDER[query.sort]} LIMIT ${limit} OFFSET ${offset}
    `;
    const records = await this.byIds(ids.map((r) => r.id), since);
    const byId = new Map(records.map((r) => [r.id, r]));
    return ids.flatMap((r) => byId.get(r.id) ?? []);
  }

  async findById(id: string, since: string): Promise<AdminUserRecord | null> {
    const [record] = await this.byIds([id], since);
    return record ?? null;
  }

  /** `channels` are those used since `since` (a day). */
  private async byIds(ids: string[], since: string): Promise<AdminUserRecord[]> {
    if (ids.length === 0) return [];
    return this.prisma.$queryRaw<AdminUserRecord[]>`
      SELECT u."id", u."name", u."telegram_username" AS "telegramUsername", u."telegram_id" AS "telegramId",
             u."phone", u."created_at" AS "createdAt", u."last_seen_at" AS "lastSeenAt",
             u."banned_at" AS "bannedAt", u."ban_reason" AS "banReason", u."deleted_at" AS "deletedAt",
             u."telegram_blocked_at" AS "telegramBlockedAt",
             (SELECT COUNT(*)::int FROM "transactions" t
               WHERE t."user_id" = u."id" AND t."deleted_at" IS NULL AND ${ENTRY}) AS "entries",
             (SELECT COUNT(*)::int FROM "accounts" a WHERE a."user_id" = u."id" AND a."deleted_at" IS NULL) AS "accounts",
             ARRAY(SELECT DISTINCT d."channel"::text AS "c" FROM "user_activity_days" d
               WHERE d."user_id" = u."id" AND d."day" >= ${since}::date ORDER BY "c") AS "channels"
      FROM "users" u
      WHERE u."id" = ANY(${ids})
    `;
  }

  /** Audit rows that must exist before the action's result is handed out (an export). */
  async audit(data: Prisma.AdminAuditLogUncheckedCreateInput): Promise<void> {
    await this.prisma.adminAuditLog.create({ data });
  }

  async counts(userId: string, now: Date): Promise<AdminUserCounts> {
    const [categories, debts, budgets, recurring, tags, sessions] = await Promise.all([
      this.prisma.category.count({ where: { userId, isSystem: false, deletedAt: null } }),
      this.prisma.debt.count({ where: { userId, deletedAt: null } }),
      this.prisma.budget.count({ where: { userId } }),
      this.prisma.recurringRule.count({ where: { userId, isActive: true } }),
      this.prisma.tag.count({ where: { userId } }),
      this.prisma.refreshToken.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: now } },
        select: { familyId: true },
        distinct: ['familyId'],
      }),
    ]);
    return { categories, debts, budgets, recurring, tags, activeSessions: sessions.length };
  }

  async entriesBySource(userId: string): Promise<Map<TransactionSource | null, number>> {
    const rows = await this.prisma.transaction.groupBy({
      by: ['source'],
      where: { userId, deletedAt: null, type: { notIn: ['ADJUSTMENT', 'TRANSFER_IN'] } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.source, r._count._all]));
  }

  async activity(userId: string, since: Date): Promise<{ day: Date; channel: ActivityChannel }[]> {
    return this.prisma.userActivityDay.findMany({
      where: { userId, day: { gte: since } },
      select: { day: true, channel: true },
      orderBy: [{ day: 'asc' }, { channel: 'asc' }],
    });
  }

  /**
   * Ban or unban, the end of every session and the audit row, all or nothing. Returns the
   * session families that were open, or null when the account was not in the expected state.
   */
  async setBan(
    userId: string,
    ban: { reason: string; at: Date } | null,
    audit: { action: AdminAuditAction; adminUserId: string; ipAddress: string | null; meta?: Prisma.InputJsonValue },
  ): Promise<string[] | null> {
    return this.prisma.$transaction(async (db) => {
      const changed = await db.user.updateMany({
        where: { id: userId, deletedAt: null, bannedAt: ban ? null : { not: null } },
        data: ban ? { bannedAt: ban.at, banReason: ban.reason } : { bannedAt: null, banReason: null },
      });
      if (changed.count === 0) return null;

      const families = ban ? await this.revokeAll(db, userId) : [];
      const meta = ban ? { reason: ban.reason, sessions: families.length } : audit.meta;
      await db.adminAuditLog.create({ data: { ...audit, meta, targetUserId: userId } });
      return families;
    });
  }

  /** Ends every session of the account and records it; returns the families that were open. */
  async revokeSessions(
    userId: string,
    audit: { adminUserId: string; ipAddress: string | null },
  ): Promise<string[]> {
    return this.prisma.$transaction(async (db) => {
      const families = await this.revokeAll(db, userId);
      await db.adminAuditLog.create({
        data: { ...audit, action: 'REVOKE_SESSIONS', targetUserId: userId, meta: { sessions: families.length } },
      });
      return families;
    });
  }

  private async revokeAll(db: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const open = await db.refreshToken.findMany({
      where: { userId, revokedAt: null },
      select: { familyId: true },
      distinct: ['familyId'],
    });
    await db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return open.map((r) => r.familyId);
  }
}
