import { Injectable } from '@nestjs/common';
import {
  StatsSummaryQuery,
  StatsSummaryResponse,
  StatsTimeseriesQuery,
  StatsTimeseriesResponse,
  StatsByCategoryQuery,
  StatsByCategoryResponse,
  StatsByAccountQuery,
  StatsByAccountResponse,
  StatsBalanceTrendQuery,
  StatsBalanceTrendResponse,
  StatsDebtsResponse,
  StatsCompareQuery,
  StatsCompareResponse,
  parseIsoDate,
  formatIsoDate,
  startOfMonth,
  endOfMonth,
  generateDateBuckets,
  calculatePreviousPeriod,
} from '@fintrack/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { BalanceService } from '../accounts/balance.service';
import { DebtsRepository } from '../debts/debts.repository';
import { StatsRepository } from './stats.repository';
import {
  calcChangePercent,
  groupCategoriesWithRollup,
  buildCompareByCategory,
} from './stats.helper';

@Injectable()
export class StatsService {
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes

  constructor(
    private readonly repository: StatsRepository,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly balanceService: BalanceService,
    private readonly debtsRepository: DebtsRepository,
  ) {}

  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cachedData = await this.redisService.get(key);
    if (cachedData) {
      try {
        return JSON.parse(cachedData) as T;
      } catch {
        // Corrupted cache - refetch
      }
    }
    const data = await fetcher();
    await this.redisService.set(key, JSON.stringify(data), this.CACHE_TTL_SECONDS);
    return data;
  }

  async getSummary(userId: string, query: StatsSummaryQuery): Promise<StatsSummaryResponse> {
    const now = new Date();
    const from = query.from ?? formatIsoDate(startOfMonth(now));
    const to = query.to ?? formatIsoDate(endOfMonth(now));
    const cacheKey = `stats:${userId}:summary:${from}:${to}`;

    return this.cached(cacheKey, async () => {
      const fromDate = parseIsoDate(from);
      const toDate = parseIsoDate(to);
      const prev = calculatePreviousPeriod(from, to);
      const prevFromDate = parseIsoDate(prev.from);
      const prevToDate = parseIsoDate(prev.to);

      const [
        totalBalanceBigInt,
        periodTotals,
        prevTotals,
        byAccount,
        debtSummary,
        topCategoryRow,
      ] = await Promise.all([
        this.balanceService.getTotalBalance(userId),
        this.repository.getPeriodTotals(userId, fromDate, toDate),
        this.repository.getPeriodTotals(userId, prevFromDate, prevToDate),
        this.getByAccount(userId, { from, to }),
        this.debtsRepository.calculateSummary(userId),
        this.repository.getTopExpenseCategory(userId, fromDate, toDate),
      ]);

      const income = BigInt(periodTotals.income);
      const expense = BigInt(periodTotals.expense);
      const net = income - expense;

      const spentPercent =
        income > 0n
          ? Math.round(Number((expense * 10000n) / income)) / 100
          : expense > 0n
            ? 100.0
            : 0.0;

      const prevExpense = BigInt(prevTotals.expense);
      const changePercent = calcChangePercent(expense, prevExpense);

      return {
        totalBalance: totalBalanceBigInt.toString(),
        isNegative: totalBalanceBigInt < 0n,
        periodIncome: income.toString(),
        periodExpense: expense.toString(),
        periodNet: net.toString(),
        spentPercent,
        byAccount: byAccount.map((a) => ({
          accountId: a.accountId,
          name: a.name,
          balance: a.balance,
        })),
        debt: {
          owedToMe: debtSummary.owedToMe.toString(),
          iOwe: debtSummary.iOwe.toString(),
          net: debtSummary.net.toString(),
          overdueCount: debtSummary.overdueCount,
        },
        topCategory: topCategoryRow
          ? {
              id: topCategoryRow.id,
              name: topCategoryRow.name,
              amount: BigInt(topCategoryRow.amount).toString(),
            }
          : null,
        transactionCount: Number(periodTotals.transactionCount),
        previousPeriod: {
          income: BigInt(prevTotals.income).toString(),
          expense: prevExpense.toString(),
          changePercent,
        },
      };
    });
  }

  async getTimeseries(
    userId: string,
    query: StatsTimeseriesQuery,
  ): Promise<StatsTimeseriesResponse> {
    const groupBy = query.groupBy || 'day';
    const cacheKey = `stats:${userId}:timeseries:${groupBy}:${query.from}:${query.to}`;

    return this.cached(cacheKey, async () => {
      const fromDate = parseIsoDate(query.from);
      const toDate = parseIsoDate(query.to);

      const rows = await this.repository.getTimeseriesRows(userId, fromDate, toDate, groupBy);
      const rowMap = new Map(rows.map((r) => [r.bucket, r]));

      const buckets = generateDateBuckets(query.from, query.to, groupBy);
      const data = buckets.map((bucket) => {
        const found = rowMap.get(bucket);
        const income = found ? BigInt(found.income) : 0n;
        const expense = found ? BigInt(found.expense) : 0n;
        const net = income - expense;
        return {
          bucket,
          income: income.toString(),
          expense: expense.toString(),
          net: net.toString(),
        };
      });

      return {
        data,
        meta: {
          groupBy,
          from: query.from,
          to: query.to,
          bucketCount: data.length,
        },
      };
    });
  }

  async getByCategory(
    userId: string,
    query: StatsByCategoryQuery,
  ): Promise<StatsByCategoryResponse> {
    const type = query.type || 'EXPENSE';
    const cacheKey = `stats:${userId}:category:${type}:${query.from}:${query.to}`;

    return this.cached(cacheKey, async () => {
      const fromDate = parseIsoDate(query.from);
      const toDate = parseIsoDate(query.to);

      const [rows, allCategories] = await Promise.all([
        this.repository.getCategoryStatRows(userId, fromDate, toDate, type),
        this.prisma.category.findMany({
          where: { userId, deletedAt: null },
          select: { id: true, name: true, icon: true, color: true, parentId: true },
        }),
      ]);

      return groupCategoriesWithRollup(rows, allCategories);
    });
  }

  async getByAccount(userId: string, query: StatsByAccountQuery): Promise<StatsByAccountResponse> {
    const cacheKey = `stats:${userId}:account:${query.from}:${query.to}`;

    return this.cached(cacheKey, async () => {
      const fromDate = parseIsoDate(query.from);
      const toDate = parseIsoDate(query.to);

      const [accountRows, { balances }] = await Promise.all([
        this.repository.getAccountStatRows(userId, fromDate, toDate),
        this.balanceService.getAccountBalances(userId),
      ]);

      return accountRows.map((row) => {
        const income = BigInt(row.income);
        const expense = BigInt(row.expense);
        const net = income - expense;
        const currentBalance = balances.get(row.accountId) ?? 0n;

        return {
          accountId: row.accountId,
          name: row.name,
          type: row.type,
          color: row.color,
          icon: row.icon,
          income: income.toString(),
          expense: expense.toString(),
          net: net.toString(),
          balance: currentBalance.toString(),
          transactionCount: Number(row.transactionCount),
        };
      });
    });
  }

  async getBalanceTrend(
    userId: string,
    query: StatsBalanceTrendQuery,
  ): Promise<StatsBalanceTrendResponse> {
    const cacheKey = `stats:${userId}:balance-trend:${query.from}:${query.to}`;

    return this.cached(cacheKey, async () => {
      const fromDate = parseIsoDate(query.from);
      const toDate = parseIsoDate(query.to);

      const [startingBalance, dailyChanges] = await Promise.all([
        this.repository.getStartingBalanceBeforeDate(userId, fromDate),
        this.repository.getDailyBalanceChanges(userId, fromDate, toDate),
      ]);

      const changesMap = new Map(dailyChanges.map((r) => [r.date, BigInt(r.change)]));
      const dayBuckets = generateDateBuckets(query.from, query.to, 'day');

      let running = startingBalance;
      const data = dayBuckets.map((date) => {
        const change = changesMap.get(date) ?? 0n;
        running += change;
        return {
          date,
          balance: running.toString(),
          change: change.toString(),
        };
      });

      return {
        data,
        meta: {
          from: query.from,
          to: query.to,
          startingBalance: startingBalance.toString(),
          endingBalance: running.toString(),
        },
      };
    });
  }

  async getDebts(userId: string): Promise<StatsDebtsResponse> {
    const cacheKey = `stats:${userId}:debts`;

    return this.cached(cacheKey, async () => {
      const [summary, debts] = await Promise.all([
        this.debtsRepository.calculateSummary(userId),
        this.prisma.debt.findMany({
          where: { userId, deletedAt: null },
          include: { payments: true },
        }),
      ]);

      const now = new Date();
      let activeCount = 0;
      let partiallyPaidCount = 0;
      let paidCount = 0;
      let overdueAmount = 0n;

      for (const d of debts) {
        if (d.status === 'ACTIVE') activeCount++;
        else if (d.status === 'PARTIALLY_PAID') partiallyPaidCount++;
        else if (d.status === 'PAID') paidCount++;

        const paid = d.payments.reduce((acc, p) => acc + p.amount, 0n);
        const remaining = d.amount - paid;
        if (d.status !== 'PAID' && d.dueDate && d.dueDate < now && remaining > 0n) {
          overdueAmount += remaining;
        }
      }

      return {
        owedToMe: summary.owedToMe.toString(),
        iOwe: summary.iOwe.toString(),
        net: summary.net.toString(),
        activeCount,
        overdueCount: summary.overdueCount,
        overdueAmount: overdueAmount.toString(),
        partiallyPaidCount,
        paidCount,
      };
    });
  }

  async getCompare(userId: string, query: StatsCompareQuery): Promise<StatsCompareResponse> {
    const cacheKey = `stats:${userId}:compare:${query.currentFrom}:${query.currentTo}:${query.previousFrom}:${query.previousTo}`;

    return this.cached(cacheKey, async () => {
      const currFrom = parseIsoDate(query.currentFrom);
      const currTo = parseIsoDate(query.currentTo);
      const prevFrom = parseIsoDate(query.previousFrom);
      const prevTo = parseIsoDate(query.previousTo);

      const [currTotals, prevTotals, currExpenses, prevExpenses] = await Promise.all([
        this.repository.getPeriodTotals(userId, currFrom, currTo),
        this.repository.getPeriodTotals(userId, prevFrom, prevTo),
        this.repository.getCategoryExpensesForPeriod(userId, currFrom, currTo),
        this.repository.getCategoryExpensesForPeriod(userId, prevFrom, prevTo),
      ]);

      const currIncome = BigInt(currTotals.income);
      const currExpense = BigInt(currTotals.expense);
      const currNet = currIncome - currExpense;

      const prevIncome = BigInt(prevTotals.income);
      const prevExpense = BigInt(prevTotals.expense);
      const prevNet = prevIncome - prevExpense;

      const incomeChange = currIncome - prevIncome;
      const expenseChange = currExpense - prevExpense;
      const netChange = currNet - prevNet;

      const byCategory = buildCompareByCategory(currExpenses, prevExpenses);

      return {
        current: {
          from: query.currentFrom,
          to: query.currentTo,
          income: currIncome.toString(),
          expense: currExpense.toString(),
          net: currNet.toString(),
          transactionCount: Number(currTotals.transactionCount),
        },
        previous: {
          from: query.previousFrom,
          to: query.previousTo,
          income: prevIncome.toString(),
          expense: prevExpense.toString(),
          net: prevNet.toString(),
          transactionCount: Number(prevTotals.transactionCount),
        },
        changes: {
          incomeChange: incomeChange.toString(),
          incomeChangePercent: calcChangePercent(currIncome, prevIncome),
          expenseChange: expenseChange.toString(),
          expenseChangePercent: calcChangePercent(currExpense, prevExpense),
          netChange: netChange.toString(),
          netChangePercent: calcChangePercent(currNet, prevNet),
        },
        byCategory,
      };
    });
  }
}
