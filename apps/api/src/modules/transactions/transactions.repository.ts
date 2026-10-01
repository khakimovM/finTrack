import { Injectable } from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from '@prisma/client';
import { ListTransactionsQuery, TransactionFilters, parseIsoDate } from '@fintrack/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';

const relationsInclude = {
  account: { select: { id: true, name: true, icon: true } },
  category: { select: { id: true, name: true, icon: true, color: true } },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
} satisfies Prisma.TransactionInclude;

export type TransactionWithRelations = Prisma.TransactionGetPayload<{ include: typeof relationsInclude }>;

export interface CreateTransactionData {
  type: TransactionType;
  accountId: string;
  amount: bigint;
  categoryId?: string | null;
  date: Date;
  note?: string | null;
}

export interface UpdateTransactionData {
  accountId?: string;
  amount?: bigint;
  categoryId?: string | null;
  date?: Date;
  note?: string | null;
}

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  buildWhereClause(userId: string, filters: TransactionFilters): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      // Rows of legacy soft-deleted accounts are outside every balance, so hide them everywhere.
      account: { deletedAt: null },
    };

    if (filters.type) where.type = filters.type as TransactionType;
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };
    if (filters.from || filters.to) {
      where.date = {
        ...(filters.from ? { gte: parseIsoDate(filters.from) } : {}),
        ...(filters.to ? { lte: parseIsoDate(filters.to) } : {}),
      };
    }
    if (filters.minAmount || filters.maxAmount) {
      where.amount = {
        ...(filters.minAmount ? { gte: BigInt(filters.minAmount) } : {}),
        ...(filters.maxAmount ? { lte: BigInt(filters.maxAmount) } : {}),
      };
    }
    if (filters.search) {
      where.note = { contains: filters.search, mode: 'insensitive' };
    }
    return where;
  }

  buildOrderBy(sort: string): Prisma.TransactionOrderByWithRelationInput[] {
    switch (sort) {
      case 'date:asc':
        return [{ date: 'asc' }, { createdAt: 'asc' }];
      case 'amount:desc':
        return [{ amount: 'desc' }, { date: 'desc' }];
      case 'amount:asc':
        return [{ amount: 'asc' }, { date: 'desc' }];
      case 'createdAt:desc':
        return [{ createdAt: 'desc' }];
      case 'createdAt:asc':
        return [{ createdAt: 'asc' }];
      case 'date:desc':
      default:
        return [{ date: 'desc' }, { createdAt: 'desc' }];
    }
  }

  async findMany(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<{ transactions: TransactionWithRelations[]; total: number }> {
    const where = this.buildWhereClause(userId, query);
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: relationsInclude,
        orderBy: this.buildOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { transactions, total };
  }

  /** Income and expense totals for the whole filter (not just the current page). */
  async calculateSums(userId: string, filters: TransactionFilters): Promise<{ income: string; expense: string }> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { ...this.buildWhereClause(userId, filters), type: { in: ['INCOME', 'EXPENSE'] } },
      _sum: { amount: true },
    });
    const sumOf = (type: TransactionType) =>
      (groups.find((g) => g.type === type)?._sum.amount ?? 0n).toString();
    return { income: sumOf('INCOME'), expense: sumOf('EXPENSE') };
  }

  async findById(userId: string, id: string, db: Db = this.prisma): Promise<TransactionWithRelations | null> {
    return db.transaction.findFirst({
      where: { id, userId, deletedAt: null },
      include: relationsInclude,
    });
  }

  async findDeletedById(userId: string, id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: { not: null }, account: { deletedAt: null } },
    });
  }

  async findLiveByIds(userId: string, ids: string[]): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({ where: { id: { in: ids }, userId, deletedAt: null } });
  }

  async create(
    db: Db,
    userId: string,
    data: CreateTransactionData,
    tagIds: string[] = [],
  ): Promise<TransactionWithRelations> {
    return db.transaction.create({
      data: {
        ...data,
        userId,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: relationsInclude,
    });
  }

  async update(
    db: Db,
    userId: string,
    id: string,
    data: UpdateTransactionData,
    tagIds?: string[],
  ): Promise<TransactionWithRelations> {
    return db.transaction.update({
      where: { id, userId, deletedAt: null },
      data: {
        ...data,
        ...(tagIds !== undefined
          ? { tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: relationsInclude,
    });
  }

  async softDelete(db: Db, userId: string, ids: string[]): Promise<number> {
    const result = await db.transaction.updateMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  async restore(db: Db, userId: string, id: string): Promise<void> {
    await db.transaction.update({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }

  async countForExport(userId: string, filters: TransactionFilters): Promise<number> {
    return this.prisma.transaction.count({ where: this.buildWhereClause(userId, filters) });
  }

  async findForExport(userId: string, filters: TransactionFilters): Promise<TransactionWithRelations[]> {
    return this.prisma.transaction.findMany({
      where: this.buildWhereClause(userId, filters),
      include: relationsInclude,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
