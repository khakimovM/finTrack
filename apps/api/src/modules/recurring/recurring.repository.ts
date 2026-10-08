import { Injectable } from '@nestjs/common';
import { Prisma, RecurringRule, RecurrenceFrequency, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';

const relationsInclude = {
  account: { select: { id: true, name: true, icon: true } },
  category: { select: { id: true, name: true, icon: true, color: true } },
} satisfies Prisma.RecurringRuleInclude;

export type RecurringRuleWithRelations = Prisma.RecurringRuleGetPayload<{ include: typeof relationsInclude }>;

const occurrenceInclude = {
  account: { select: { id: true, name: true, icon: true } },
  category: { select: { id: true, name: true, icon: true, color: true } },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
} satisfies Prisma.TransactionInclude;

export type OccurrenceWithRelations = Prisma.TransactionGetPayload<{ include: typeof occurrenceInclude }>;

export interface LockedRule extends RecurringRule {
  timezone: string;
  accountActive: boolean;
}

export interface CreateRecurringData {
  accountId: string;
  categoryId?: string | null;
  type: TransactionType;
  amount: bigint;
  frequency: RecurrenceFrequency;
  dayOfCycle: number | null;
  startsAt: Date;
  endsAt: Date | null;
  nextRunAt: Date;
  note?: string | null;
}

export interface UpdateRecurringData {
  amount?: bigint;
  note?: string | null;
  isActive?: boolean;
  dayOfCycle?: number | null;
  endsAt?: Date | null;
  nextRunAt?: Date;
}

@Injectable()
export class RecurringRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string, isActive?: boolean): Promise<RecurringRuleWithRelations[]> {
    return this.prisma.recurringRule.findMany({
      where: { userId, ...(isActive !== undefined ? { isActive } : {}) },
      include: relationsInclude,
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });
  }

  async findById(userId: string, id: string): Promise<RecurringRuleWithRelations | null> {
    return this.prisma.recurringRule.findFirst({ where: { id, userId }, include: relationsInclude });
  }

  async create(userId: string, data: CreateRecurringData): Promise<RecurringRuleWithRelations> {
    return this.prisma.recurringRule.create({
      data: { ...data, userId, isActive: true },
      include: relationsInclude,
    });
  }

  async update(userId: string, id: string, data: UpdateRecurringData): Promise<RecurringRuleWithRelations> {
    return this.prisma.recurringRule.update({
      where: { id, userId },
      data,
      include: relationsInclude,
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.prisma.recurringRule.delete({ where: { id, userId } });
  }

  /** System-wide scan for the scheduler; each rule is then processed under its own lock. */
  async findDueRuleIds(dueOnOrBefore: Date): Promise<string[]> {
    const rows = await this.prisma.recurringRule.findMany({
      where: { isActive: true, nextRunAt: { lte: dueOnOrBefore } },
      select: { id: true },
      orderBy: { nextRunAt: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Locks the rule row so the hourly job and a manual run-now can never materialise the same
   * occurrence twice, and returns what the runner needs to know about its owner and account.
   */
  async lock(db: Db, id: string, userId?: string): Promise<LockedRule | null> {
    const locked = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM recurring_rules WHERE id = ${id} FOR UPDATE
    `;
    if (locked.length === 0) return null;

    const rule = await db.recurringRule.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      include: {
        user: { select: { timezone: true, deletedAt: true } },
        account: { select: { deletedAt: true, archivedAt: true } },
      },
    });
    if (!rule || rule.user.deletedAt) return null;

    const { user, account, ...plain } = rule;
    return {
      ...plain,
      timezone: user.timezone,
      accountActive: account.deletedAt === null && account.archivedAt === null,
    };
  }

  /** Includes soft-deleted rows: an occurrence the user deleted must not be recreated. */
  async findOccurrence(db: Db, ruleId: string, date: Date): Promise<Transaction | null> {
    return db.transaction.findFirst({ where: { recurringRuleId: ruleId, date } });
  }

  async findLiveOccurrence(db: Db, ruleId: string, date: Date): Promise<OccurrenceWithRelations | null> {
    return db.transaction.findFirst({
      where: { recurringRuleId: ruleId, date, deletedAt: null },
      include: occurrenceInclude,
    });
  }

  async createOccurrence(db: Db, rule: RecurringRule, date: Date): Promise<OccurrenceWithRelations> {
    return db.transaction.create({
      data: {
        userId: rule.userId,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        type: rule.type,
        amount: rule.amount,
        date,
        note: rule.note ?? 'Takroriy to‘lov',
        recurringRuleId: rule.id,
        source: 'RECURRING',
      },
      include: occurrenceInclude,
    });
  }

  async saveSchedule(db: Db, id: string, nextRunAt: Date, isActive: boolean): Promise<RecurringRuleWithRelations> {
    return db.recurringRule.update({
      where: { id },
      data: { nextRunAt, isActive },
      include: relationsInclude,
    });
  }
}
