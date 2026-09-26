import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type BudgetWithCategory = Prisma.BudgetGetPayload<{
  include: { category: true };
}>;

@Injectable()
export class BudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCategoryAndMonth(
    userId: string,
    categoryId: string,
    monthDate: Date,
  ): Promise<BudgetWithCategory | null> {
    return this.prisma.budget.findFirst({
      where: {
        userId,
        categoryId,
        month: monthDate,
      },
      include: {
        category: true,
      },
    });
  }

  async findManyByMonth(userId: string, monthDate: Date): Promise<BudgetWithCategory[]> {
    return this.prisma.budget.findMany({
      where: {
        userId,
        month: monthDate,
      },
      include: {
        category: true,
      },
      orderBy: {
        limitAmount: 'desc',
      },
    });
  }

  async findById(userId: string, id: string): Promise<BudgetWithCategory | null> {
    return this.prisma.budget.findFirst({
      where: { id, userId },
      include: {
        category: true,
      },
    });
  }

  async create(
    userId: string,
    data: {
      categoryId: string;
      month: Date;
      limitAmount: bigint;
    },
  ): Promise<BudgetWithCategory> {
    return this.prisma.budget.create({
      data: {
        userId,
        categoryId: data.categoryId,
        month: data.month,
        limitAmount: data.limitAmount,
      },
      include: {
        category: true,
      },
    });
  }

  async update(
    userId: string,
    id: string,
    data: {
      limitAmount: bigint;
    },
  ): Promise<BudgetWithCategory | null> {
    const existing = await this.findById(userId, id);
    if (!existing) return null;

    return this.prisma.budget.update({
      where: { id },
      data: {
        limitAmount: data.limitAmount,
      },
      include: {
        category: true,
      },
    });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.findById(userId, id);
    if (!existing) return false;

    await this.prisma.budget.delete({
      where: { id },
    });
    return true;
  }

  async updateNotifiedAt(id: string, notifiedAt: number): Promise<void> {
    await this.prisma.budget.update({
      where: { id },
      data: { notifiedAt },
    });
  }

  /**
   * Sums all EXPENSE transactions for a category within a date range from the ledger.
   */
  async getCategorySpent(
    userId: string,
    categoryId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<bigint> {
    const result = await this.prisma.transaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        userId,
        categoryId,
        type: 'EXPENSE',
        deletedAt: null,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return result._sum.amount ?? 0n;
  }
}
