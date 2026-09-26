import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface TimeseriesRow {
  bucket: string;
  income: bigint | string | number;
  expense: bigint | string | number;
}

export interface CategoryStatRow {
  categoryId: string | null;
  categoryName: string | null;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  amount: bigint | string | number;
  count: number | string | bigint;
}

export interface AccountStatRow {
  accountId: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  income: bigint | string | number;
  expense: bigint | string | number;
  transactionCount: number | string | bigint;
}

export interface BalanceTrendRow {
  date: string;
  change: bigint | string | number;
}

export interface PeriodTotalsRow {
  income: bigint | string | number;
  expense: bigint | string | number;
  transactionCount: number | string | bigint;
}

export interface TopCategoryRow {
  id: string;
  name: string;
  amount: bigint | string | number;
}

export interface CompareCategoryRow {
  categoryId: string | null;
  name: string | null;
  color: string | null;
  icon: string | null;
  amount: bigint | string | number;
}

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeseriesRows(
    userId: string,
    fromDate: Date,
    toDate: Date,
    groupBy: 'day' | 'week' | 'month' | 'year',
  ): Promise<TimeseriesRow[]> {
    return this.prisma.$queryRaw<TimeseriesRow[]>`
      SELECT
        to_char(date_trunc(${Prisma.raw(`'${groupBy}'`)}, t.date::timestamp), 'YYYY-MM-DD') AS bucket,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'), 0) AS income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS expense
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.date >= ${fromDate}
        AND t.date <= ${toDate}
        AND t.type IN ('INCOME', 'EXPENSE')
      GROUP BY 1
      ORDER BY 1 ASC;
    `;
  }

  async getCategoryStatRows(
    userId: string,
    fromDate: Date,
    toDate: Date,
    type: 'EXPENSE' | 'INCOME',
  ): Promise<CategoryStatRow[]> {
    return this.prisma.$queryRaw<CategoryStatRow[]>`
      SELECT
        t.category_id AS "categoryId",
        c.name AS "categoryName",
        c.icon AS "icon",
        c.color AS "color",
        c.parent_id AS "parentId",
        COALESCE(SUM(t.amount), 0) AS amount,
        COUNT(t.id)::int AS count
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.date >= ${fromDate}
        AND t.date <= ${toDate}
        AND t.type = ${type}::"TransactionType"
      GROUP BY t.category_id, c.name, c.icon, c.color, c.parent_id
      ORDER BY amount DESC;
    `;
  }

  async getAccountStatRows(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<AccountStatRow[]> {
    return this.prisma.$queryRaw<AccountStatRow[]>`
      SELECT
        a.id AS "accountId",
        a.name AS "name",
        a.type AS "type",
        a.color AS "color",
        a.icon AS "icon",
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'), 0) AS income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS expense,
        COUNT(t.id) FILTER (WHERE t.type IN ('INCOME', 'EXPENSE'))::int AS "transactionCount"
      FROM accounts a
      LEFT JOIN transactions t
        ON t.account_id = a.id
        AND t.deleted_at IS NULL
        AND t.date >= ${fromDate}
        AND t.date <= ${toDate}
        AND t.type IN ('INCOME', 'EXPENSE')
      WHERE a.user_id = ${userId}
        AND a.deleted_at IS NULL
      GROUP BY a.id, a.name, a.type, a.color, a.icon, a.sort_order
      ORDER BY a.sort_order ASC, a.created_at ASC;
    `;
  }

  async getStartingBalanceBeforeDate(userId: string, fromDate: Date): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<{ startingBalance: bigint | string | number }[]>`
      SELECT
        (SELECT COALESCE(SUM(a.opening_balance), 0) FROM accounts a WHERE a.user_id = ${userId} AND a.deleted_at IS NULL)
        +
        COALESCE(SUM(
          CASE
            WHEN t.type IN ('INCOME', 'TRANSFER_IN', 'LOAN_TAKEN', 'LOAN_REPAY_IN') THEN t.amount
            WHEN t.type IN ('EXPENSE', 'TRANSFER_OUT', 'LOAN_GIVEN', 'LOAN_REPAY_OUT') THEN -t.amount
            ELSE 0
          END
        ), 0) AS "startingBalance"
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.date < ${fromDate};
    `;
    const bal = rows[0]?.startingBalance ?? 0n;
    return BigInt(bal);
  }

  async getDailyBalanceChanges(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<BalanceTrendRow[]> {
    return this.prisma.$queryRaw<BalanceTrendRow[]>`
      SELECT
        to_char(t.date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(
          CASE
            WHEN t.type IN ('INCOME', 'TRANSFER_IN', 'LOAN_TAKEN', 'LOAN_REPAY_IN') THEN t.amount
            WHEN t.type IN ('EXPENSE', 'TRANSFER_OUT', 'LOAN_GIVEN', 'LOAN_REPAY_OUT') THEN -t.amount
            ELSE 0
          END
        ), 0) AS change
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.date >= ${fromDate}
        AND t.date <= ${toDate}
      GROUP BY t.date
      ORDER BY t.date ASC;
    `;
  }

  async getPeriodTotals(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<PeriodTotalsRow> {
    const rows = await this.prisma.$queryRaw<PeriodTotalsRow[]>`
      SELECT
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'), 0) AS income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS expense,
        COUNT(t.id) FILTER (WHERE t.type IN ('INCOME', 'EXPENSE'))::int AS "transactionCount"
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.date >= ${fromDate}
        AND t.date <= ${toDate}
        AND t.type IN ('INCOME', 'EXPENSE');
    `;
    return rows[0] ?? { income: 0n, expense: 0n, transactionCount: 0 };
  }

  async getTopExpenseCategory(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<TopCategoryRow | null> {
    const rows = await this.prisma.$queryRaw<TopCategoryRow[]>`
      SELECT
        COALESCE(c.id, 'uncategorized') AS id,
        COALESCE(c.name, 'Boshqa') AS name,
        SUM(t.amount) AS amount
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.date >= ${fromDate}
        AND t.date <= ${toDate}
        AND t.type = 'EXPENSE'
      GROUP BY c.id, c.name
      ORDER BY amount DESC
      LIMIT 1;
    `;
    return rows[0] ?? null;
  }

  async getCategoryExpensesForPeriod(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<CompareCategoryRow[]> {
    return this.prisma.$queryRaw<CompareCategoryRow[]>`
      SELECT
        c.id AS "categoryId",
        c.name AS name,
        c.color AS color,
        c.icon AS icon,
        SUM(t.amount) AS amount
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.date >= ${fromDate}
        AND t.date <= ${toDate}
        AND t.type = 'EXPENSE'
      GROUP BY c.id, c.name, c.color, c.icon
      ORDER BY amount DESC;
    `;
  }
}
