import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { toBigInt } from '../../infra/prisma/ledger-sql';

export type BudgetWithCategory = Prisma.BudgetGetPayload<{ include: { category: true } }>;

interface CategorySpendRow {
  categoryId: string;
  parentId: string | null;
  spent: unknown;
}

@Injectable()
export class BudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCategoryAndMonth(
    userId: string,
    categoryId: string,
    month: Date,
  ): Promise<BudgetWithCategory | null> {
    return this.prisma.budget.findFirst({
      where: { userId, categoryId, month, category: { deletedAt: null } },
      include: { category: true },
    });
  }

  async findManyByMonth(userId: string, month: Date): Promise<BudgetWithCategory[]> {
    return this.prisma.budget.findMany({
      where: { userId, month, category: { deletedAt: null } },
      include: { category: true },
      orderBy: { limitAmount: 'desc' },
    });
  }

  async findById(userId: string, id: string): Promise<BudgetWithCategory | null> {
    return this.prisma.budget.findFirst({ where: { id, userId }, include: { category: true } });
  }

  async create(
    userId: string,
    data: { categoryId: string; month: Date; limitAmount: bigint },
  ): Promise<BudgetWithCategory> {
    return this.prisma.budget.create({
      data: { userId, ...data },
      include: { category: true },
    });
  }

  async update(
    userId: string,
    id: string,
    data: { limitAmount: bigint; notifiedAt: number },
  ): Promise<BudgetWithCategory> {
    return this.prisma.budget.update({
      where: { id, userId },
      data,
      include: { category: true },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.prisma.budget.delete({ where: { id, userId } });
  }

  /**
   * Atomically records that `threshold` was announced. Returns true only for the single caller
   * that moved the marker, which makes the 80%/100% alerts fire exactly once even when two
   * expenses land at the same moment.
   */
  async claimThreshold(userId: string, budgetId: string, threshold: number): Promise<boolean> {
    const result = await this.prisma.budget.updateMany({
      where: { id: budgetId, userId, notifiedAt: { lt: threshold } },
      data: { notifiedAt: threshold },
    });
    return result.count === 1;
  }

  /**
   * EXPENSE totals per category for a date range. A budget on a parent category covers its
   * subcategories, so callers roll children up into their parent.
   */
  async expenseByCategory(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ categoryId: string; parentId: string | null; spent: bigint }>> {
    const rows = await this.prisma.$queryRaw<CategorySpendRow[]>`
      SELECT t.category_id AS "categoryId", c.parent_id AS "parentId", SUM(t.amount) AS spent
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      JOIN accounts a ON a.id = t.account_id AND a.deleted_at IS NULL
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.type = 'EXPENSE'
        AND t.date >= ${from}
        AND t.date <= ${to}
      GROUP BY t.category_id, c.parent_id
    `;
    return rows.map((r) => ({ categoryId: r.categoryId, parentId: r.parentId, spent: toBigInt(r.spent) }));
  }
}
