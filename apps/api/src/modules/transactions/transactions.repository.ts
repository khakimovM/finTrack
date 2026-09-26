import { Injectable } from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ListTransactionsQuery, ExportTransactionsQuery } from '@fintrack/shared';

export type TransactionWithRelations = Transaction & {
  account: {
    id: string;
    name: string;
    icon: string;
  };
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  tags: Array<{
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }>;
};

export interface CreateTransactionData {
  type: TransactionType;
  accountId: string;
  amount: bigint;
  categoryId?: string | null;
  date: Date;
  note?: string | null;
  recurringRuleId?: string | null;
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

  private getRelationsInclude() {
    return {
      account: {
        select: { id: true, name: true, icon: true },
      },
      category: {
        select: { id: true, name: true, icon: true, color: true },
      },
      tags: {
        include: {
          tag: {
            select: { id: true, name: true, color: true },
          },
        },
      },
    };
  }

  buildWhereClause(userId: string, query: Partial<ListTransactionsQuery>): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
    };

    if (query.type) {
      where.type = query.type as TransactionType;
    }
    if (query.accountId) {
      where.accountId = query.accountId;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.tagId) {
      where.tags = {
        some: { tagId: query.tagId },
      };
    }
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.minAmount || query.maxAmount) {
      where.amount = {
        ...(query.minAmount ? { gte: BigInt(query.minAmount) } : {}),
        ...(query.maxAmount ? { lte: BigInt(query.maxAmount) } : {}),
      };
    }
    if (query.search) {
      where.note = {
        contains: query.search,
        mode: 'insensitive',
      };
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
    const orderBy = this.buildOrderBy(query.sort);
    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: this.getRelationsInclude(),
        orderBy,
        skip,
        take,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  async calculateSums(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<{ income: string; expense: string }> {
    const baseWhere = this.buildWhereClause(userId, query);

    const [incomeResult, expenseResult] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    return {
      income: (incomeResult._sum.amount ?? 0n).toString(),
      expense: (expenseResult._sum.amount ?? 0n).toString(),
    };
  }

  async findById(userId: string, id: string): Promise<TransactionWithRelations | null> {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: this.getRelationsInclude(),
    });
  }

  async findDeletedById(userId: string, id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        userId,
        deletedAt: { not: null },
      },
    });
  }

  async create(
    userId: string,
    data: CreateTransactionData,
    tagIds?: string[],
  ): Promise<TransactionWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: data.type,
          accountId: data.accountId,
          amount: data.amount,
          categoryId: data.categoryId,
          date: data.date,
          note: data.note,
          recurringRuleId: data.recurringRuleId,
        },
      });

      if (tagIds && tagIds.length > 0) {
        await tx.transactionTag.createMany({
          data: tagIds.map((tagId) => ({
            transactionId: transaction.id,
            tagId,
          })),
        });
      }

      return tx.transaction.findUniqueOrThrow({
        where: { id: transaction.id },
        include: this.getRelationsInclude(),
      });
    });
  }

  async update(
    userId: string,
    id: string,
    data: UpdateTransactionData,
    tagIds?: string[],
  ): Promise<TransactionWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id },
        data,
      });

      if (tagIds !== undefined) {
        await tx.transactionTag.deleteMany({
          where: { transactionId: id },
        });

        if (tagIds.length > 0) {
          await tx.transactionTag.createMany({
            data: tagIds.map((tagId) => ({
              transactionId: id,
              tagId,
            })),
          });
        }
      }

      return tx.transaction.findUniqueOrThrow({
        where: { id },
        include: this.getRelationsInclude(),
      });
    });
  }

  async softDelete(userId: string, transaction: Transaction): Promise<void> {
    const now = new Date();
    if (transaction.transferGroupId) {
      await this.prisma.transaction.updateMany({
        where: {
          transferGroupId: transaction.transferGroupId,
          userId,
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
    } else {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { deletedAt: now },
      });
    }
  }

  async bulkSoftDelete(userId: string, ids: string[]): Promise<void> {
    const now = new Date();
    const transactions = await this.prisma.transaction.findMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      select: { id: true, transferGroupId: true },
    });

    const transferGroupIds = transactions
      .map((t) => t.transferGroupId)
      .filter((gid): gid is string => Boolean(gid));

    await this.prisma.transaction.updateMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { id: { in: ids } },
          ...(transferGroupIds.length > 0 ? [{ transferGroupId: { in: transferGroupIds } }] : []),
        ],
      },
      data: { deletedAt: now },
    });
  }

  async restore(userId: string, transaction: Transaction): Promise<void> {
    if (transaction.transferGroupId) {
      await this.prisma.transaction.updateMany({
        where: {
          transferGroupId: transaction.transferGroupId,
          userId,
        },
        data: { deletedAt: null },
      });
    } else {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { deletedAt: null },
      });
    }
  }

  async findForExport(
    userId: string,
    query: ExportTransactionsQuery,
  ): Promise<TransactionWithRelations[]> {
    const where = this.buildWhereClause(userId, query);
    return this.prisma.transaction.findMany({
      where,
      include: this.getRelationsInclude(),
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
