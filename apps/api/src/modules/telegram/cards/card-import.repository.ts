import { Injectable } from '@nestjs/common';
import { CardImport, CardNetwork, CardOperation, PaymentCard, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { formatIsoDate } from '@fintrack/shared';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ManualEntry, SavedPurchase } from './card-planner';

export type ImportOperation = CardOperation & { card: PaymentCard };
export type ImportWithOperations = CardImport & { operations: ImportOperation[] };

export interface NewOperation {
  fingerprint: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: bigint;
  merchant: string;
  label: string;
  occurredAt: Date;
  date: Date;
  balanceAfter: bigint | null;
  reversal: boolean;
}

/** What became of a forwarded operation: new, already imported, or moved out of an abandoned import. */
export type AddOutcome = 'new' | 'repeated' | 'requeued';

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Every query here is scoped by the owner's id, including the ones by import id. */
@Injectable()
export class CardImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Two forwards of a new card can arrive at once; the slower one reads the faster one's row. */
  async upsertCard(userId: string, network: CardNetwork, last4: string): Promise<PaymentCard> {
    const where = { userId_network_last4: { userId, network, last4 } };
    try {
      return await this.prisma.paymentCard.upsert({ where, create: { userId, network, last4 }, update: {} });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return this.prisma.paymentCard.findUniqueOrThrow({ where });
    }
  }

  async addOperation(userId: string, cardId: string, data: NewOperation): Promise<AddOutcome> {
    try {
      await this.prisma.cardOperation.create({ data: { ...data, userId, cardId } });
      return 'new';
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
    // Still undecided in an import the person walked away from: it joins the new burst instead.
    const requeued = await this.prisma.cardOperation.updateMany({
      where: { userId, fingerprint: data.fingerprint, status: 'PENDING', importId: { not: null } },
      data: {
        importId: null,
        seq: null,
        resolution: null,
        categoryId: null,
        categorySource: null,
        counterAccountId: null,
        pairedId: null,
        debtPerson: null,
        transactionId: null,
      },
    });
    return requeued.count > 0 ? 'requeued' : 'repeated';
  }

  /**
   * Gathers the person's unassigned operations into a new import, numbered by time. Two flushes
   * racing for the same operations each get only those they claimed first. Null when there was
   * nothing to gather and nothing to report.
   */
  async claim(userId: string, counters: { ignored: number; repeated: number }): Promise<string | null> {
    return this.prisma.$transaction(async (db) => {
      const ops = await db.cardOperation.findMany({
        where: { userId, status: 'PENDING', importId: null },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (ops.length === 0 && counters.ignored === 0 && counters.repeated === 0) return null;

      const id = randomBytes(6).toString('base64url');
      await db.cardImport.create({ data: { id, userId, ...counters } });
      let seq = 0;
      for (const op of ops) {
        const taken = await db.cardOperation.updateMany({
          where: { id: op.id, userId, importId: null },
          data: { importId: id, seq: seq + 1 },
        });
        seq += taken.count;
      }
      return id;
    });
  }

  async findImport(userId: string, id: string): Promise<ImportWithOperations | null> {
    return this.prisma.cardImport.findFirst({
      where: { id, userId },
      include: { operations: { where: { userId }, include: { card: true }, orderBy: { seq: 'asc' } } },
    });
  }

  async findOperation(userId: string, importId: string, seq: number): Promise<ImportOperation | null> {
    return this.prisma.cardOperation.findFirst({ where: { userId, importId, seq }, include: { card: true } });
  }

  /** Changes only operations still waiting: a saved one is the ledger's now. Returns the count. */
  async updatePending(userId: string, ids: string[], data: Prisma.CardOperationUncheckedUpdateManyInput): Promise<number> {
    const result = await this.prisma.cardOperation.updateMany({ where: { id: { in: ids }, userId, status: 'PENDING' }, data });
    return result.count;
  }

  async setCardAccount(userId: string, cardId: string, accountId: string): Promise<void> {
    await this.prisma.paymentCard.updateMany({ where: { id: cardId, userId }, data: { accountId } });
  }

  async markPlanned(userId: string, importId: string): Promise<void> {
    await this.prisma.cardImport.updateMany({ where: { id: importId, userId }, data: { plannedAt: new Date() } });
  }

  /** merchantKey → category, for live expense categories only. */
  async memory(userId: string, keys: string[]): Promise<Map<string, string>> {
    if (keys.length === 0) return new Map();
    const rows = await this.prisma.merchantCategory.findMany({
      where: { userId, merchantKey: { in: [...new Set(keys)] }, category: { userId, deletedAt: null, type: 'EXPENSE' } },
    });
    return new Map(rows.map((r) => [r.merchantKey, r.categoryId]));
  }

  async remember(userId: string, entries: Array<{ merchantKey: string; categoryId: string }>): Promise<void> {
    for (const { merchantKey, categoryId } of entries) {
      await this.prisma.merchantCategory.upsert({
        where: { userId_merchantKey: { userId, merchantKey } },
        create: { userId, merchantKey, categoryId },
        update: { categoryId },
      });
    }
  }

  /** Rows the person entered themselves on these dates with these amounts, not yet matched to a card operation. */
  async manualEntries(userId: string, dates: Date[], amounts: bigint[]): Promise<ManualEntry[]> {
    if (dates.length === 0) return [];
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { in: dates },
        amount: { in: [...new Set(amounts)] },
        OR: [{ source: null }, { source: { not: 'CARD' } }],
      },
      select: { id: true, accountId: true, type: true, amount: true, date: true },
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length === 0) return [];
    const linked = await this.prisma.cardOperation.findMany({
      where: { userId, transactionId: { in: rows.map((r) => r.id) } },
      select: { transactionId: true },
    });
    const taken = new Set(linked.map((l) => l.transactionId));
    return rows.filter((r) => !taken.has(r.id)).map((r) => ({ ...r, date: formatIsoDate(r.date) }));
  }

  /** Purchases already in the ledger from earlier imports, that no refund has cancelled yet. */
  async savedPurchases(userId: string, cardIds: string[], since: Date): Promise<SavedPurchase[]> {
    if (cardIds.length === 0) return [];
    return this.prisma.cardOperation.findMany({
      where: {
        userId,
        cardId: { in: cardIds },
        direction: 'DEBIT',
        reversal: false,
        status: { in: ['SAVED', 'LINKED'] },
        resolution: { in: ['EXPENSE', 'DUPLICATE'] },
        pairedId: null,
        transactionId: { not: null },
        occurredAt: { gte: since },
      },
      select: { id: true, cardId: true, amount: true, merchant: true, occurredAt: true, transactionId: true },
      orderBy: { occurredAt: 'asc' },
    });
  }

  /** The bank's latest known balance of each card. */
  async latestBalances(userId: string, cardIds: string[]): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>();
    for (const cardId of new Set(cardIds)) {
      const op = await this.prisma.cardOperation.findFirst({
        where: { userId, cardId, balanceAfter: { not: null } },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: { balanceAfter: true },
      });
      if (op?.balanceAfter !== null && op?.balanceAfter !== undefined) result.set(cardId, op.balanceAfter);
    }
    return result;
  }

  /** Cancelling before anything was saved: the messages can be forwarded again later. */
  async discardPending(userId: string, importId: string): Promise<number> {
    const removed = await this.prisma.cardOperation.deleteMany({ where: { userId, importId, status: 'PENDING' } });
    const left = await this.prisma.cardOperation.count({ where: { userId, importId } });
    if (left === 0) await this.prisma.cardImport.deleteMany({ where: { id: importId, userId } });
    return removed.count;
  }
}
