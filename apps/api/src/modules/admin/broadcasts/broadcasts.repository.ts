import { Injectable } from '@nestjs/common';
import { Broadcast, BroadcastDeliveryStatus, BroadcastSegment, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

export interface Audience {
  segment: BroadcastSegment;
  includeOptedOut: boolean;
  /** First day of the "last 30 days" (a Tashkent day). */
  since: string;
}

export interface ClaimedRecipient {
  userId: string;
  telegramId: bigint;
}

export interface DeliveryOutcome {
  userId: string;
  status: Extract<BroadcastDeliveryStatus, 'SENT' | 'BLOCKED' | 'FAILED'>;
  error?: string;
}

/** A row claimed this long ago and still SENDING belongs to a run that died mid-send. */
const INTERRUPTED_AFTER = Prisma.sql`interval '2 minutes'`;

const ACTIVE = (since: string) =>
  Prisma.sql`EXISTS (SELECT 1 FROM "user_activity_days" d WHERE d."user_id" = u."id" AND d."day" >= ${since}::date)`;

/** People who can be reached at all: a live, unbanned account with Telegram. */
function inSegment(a: Audience): Prisma.Sql {
  const base = Prisma.sql`u."deleted_at" IS NULL AND u."banned_at" IS NULL AND u."telegram_id" IS NOT NULL`;
  if (a.segment === 'ACTIVE_30D') return Prisma.sql`${base} AND ${ACTIVE(a.since)}`;
  if (a.segment === 'INACTIVE_30D') return Prisma.sql`${base} AND NOT ${ACTIVE(a.since)}`;
  return base;
}

/** …of whom these get it: not blocked the bot, and notifications on unless the owner includes everyone. */
function recipients(a: Audience): Prisma.Sql {
  const optIn = a.includeOptedOut ? Prisma.empty : Prisma.sql` AND u."notify_telegram" = TRUE`;
  return Prisma.sql`${inSegment(a)} AND u."telegram_blocked_at" IS NULL${optIn}`;
}

/**
 * Broadcasts and their recipients. Like the rest of the admin module this reads across users
 * (docs/09); it touches only who gets the message and how the delivery went.
 */
@Injectable()
export class BroadcastsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async preview(a: Audience): Promise<{ recipients: number; botBlocked: number; optedOut: number }> {
    const [row] = await this.prisma.$queryRaw<[{ recipients: number; botBlocked: number; optedOut: number }]>`
      SELECT COUNT(*) FILTER (WHERE ${recipients(a)})::int AS "recipients",
             COUNT(*) FILTER (WHERE u."telegram_blocked_at" IS NOT NULL)::int AS "botBlocked",
             COUNT(*) FILTER (WHERE u."telegram_blocked_at" IS NULL AND u."notify_telegram" = FALSE
                              AND ${a.includeOptedOut ? Prisma.sql`FALSE` : Prisma.sql`TRUE`})::int AS "optedOut"
      FROM "users" u
      WHERE ${inSegment(a)}
    `;
    return row;
  }

  /**
   * The broadcast, its fixed list of recipients and the audit row, all or nothing. Returns null
   * when the list no longer has `expected` people (the confirmation showed another number).
   */
  async create(
    data: { adminUserId: string; text: string; ipAddress: string | null },
    a: Audience,
    expected: number,
  ): Promise<{ broadcast: Broadcast | null; actual: number }> {
    return this.prisma.$transaction(async (db) => {
      const broadcast = await db.broadcast.create({
        data: { adminUserId: data.adminUserId, text: data.text, segment: a.segment, includeOptedOut: a.includeOptedOut, total: 0 },
      });
      const actual = await db.$executeRaw`
        INSERT INTO "broadcast_recipients" ("broadcast_id", "user_id", "telegram_id")
        SELECT ${broadcast.id}, u."id", u."telegram_id" FROM "users" u WHERE ${recipients(a)}
      `;
      if (actual !== expected) throw new RecipientsChanged(actual);
      await db.adminAuditLog.create({
        data: {
          action: 'BROADCAST',
          adminUserId: data.adminUserId,
          ipAddress: data.ipAddress,
          meta: { broadcastId: broadcast.id, segment: a.segment, includeOptedOut: a.includeOptedOut, recipients: actual },
        },
      });
      return { broadcast: await db.broadcast.update({ where: { id: broadcast.id }, data: { total: actual } }), actual };
    }).catch((err: unknown) => {
      if (err instanceof RecipientsChanged) return { broadcast: null, actual: err.actual };
      throw err;
    });
  }

  findById(id: string): Promise<Broadcast | null> {
    return this.prisma.broadcast.findUnique({ where: { id } });
  }

  async list(skip: number, take: number): Promise<{ rows: Broadcast[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.broadcast.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.prisma.broadcast.count(),
    ]);
    return { rows, total };
  }

  /** One broadcast at a time: two would share (and overrun) the bot's message budget. */
  findUnfinished(): Promise<Broadcast | null> {
    return this.prisma.broadcast.findFirst({ where: { status: { not: 'DONE' } } });
  }

  async markStarted(id: string): Promise<void> {
    await this.prisma.broadcast.updateMany({ where: { id, status: 'QUEUED' }, data: { status: 'SENDING', startedAt: new Date() } });
  }

  /** Rows a dead run had taken may or may not have reached the person: never try them again. */
  async failInterrupted(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "broadcast_recipients" SET "status" = 'FAILED', "error" = 'interrupted'
      WHERE "broadcast_id" = ${id} AND "status" = 'SENDING' AND "claimed_at" < now() - ${INTERRUPTED_AFTER}
    `;
  }

  /** Takes up to `limit` waiting rows for this run; parallel runs never take the same row. */
  claim(id: string, limit: number): Promise<ClaimedRecipient[]> {
    return this.prisma.$queryRaw<ClaimedRecipient[]>`
      UPDATE "broadcast_recipients" r SET "status" = 'SENDING', "claimed_at" = now()
      FROM (
        SELECT "user_id" FROM "broadcast_recipients"
        WHERE "broadcast_id" = ${id} AND "status" = 'PENDING'
        ORDER BY "user_id" LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) picked
      WHERE r."broadcast_id" = ${id} AND r."user_id" = picked."user_id"
      RETURNING r."user_id" AS "userId", r."telegram_id" AS "telegramId"
    `;
  }

  async record(id: string, outcomes: DeliveryOutcome[]): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(
      outcomes.map((o) =>
        this.prisma.broadcastRecipient.updateMany({
          where: { broadcastId: id, userId: o.userId, status: 'SENDING' },
          data: { status: o.status, sentAt: o.status === 'SENT' ? now : null, error: o.error?.slice(0, 200) ?? null },
        }),
      ),
    );
  }

  /** Copies the per-row results onto the broadcast; marks it done once nothing is waiting. */
  async refreshCounts(id: string, finish: boolean): Promise<Broadcast> {
    const groups = await this.prisma.broadcastRecipient.groupBy({ by: ['status'], where: { broadcastId: id }, _count: { _all: true } });
    const n = (status: BroadcastDeliveryStatus) => groups.find((g) => g.status === status)?._count._all ?? 0;
    return this.prisma.broadcast.update({
      where: { id },
      data: {
        sent: n('SENT'),
        blocked: n('BLOCKED'),
        failed: n('FAILED'),
        ...(finish ? { status: 'DONE', finishedAt: new Date() } : {}),
      },
    });
  }
}

class RecipientsChanged extends Error {
  constructor(readonly actual: number) {
    super('recipients changed');
  }
}
