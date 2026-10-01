import { z } from 'zod';
import { isoDateSchema, refineDateRange } from './common';

const dateString = isoDateSchema;

/** Hard caps keep zero-filled series bounded (a century of daily buckets is a DoS vector). */
export const STATS_MAX_RANGE_DAYS = {
  day: 400,
  week: 3 * 366,
  month: 50 * 366,
  year: 100 * 366,
  any: 100 * 366,
} as const;

// ==========================================
// 1. STATS SUMMARY
// ==========================================

export const StatsSummaryQuerySchema = z
  .object({
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .superRefine((v, ctx) => refineDateRange(v, ctx, STATS_MAX_RANGE_DAYS.any));

export type StatsSummaryQuery = z.infer<typeof StatsSummaryQuerySchema>;

export const StatsSummaryResponseSchema = z.object({
  totalBalance: z.string(),
  isNegative: z.boolean(),
  periodIncome: z.string(),
  periodExpense: z.string(),
  periodNet: z.string(),
  spentPercent: z.number(),
  byAccount: z.array(
    z.object({
      accountId: z.string(),
      name: z.string(),
      balance: z.string(),
    }),
  ),
  debt: z.object({
    owedToMe: z.string(),
    iOwe: z.string(),
    net: z.string(),
    overdueCount: z.number(),
  }),
  topCategory: z
    .object({
      id: z.string(),
      name: z.string(),
      amount: z.string(),
    })
    .nullable(),
  transactionCount: z.number(),
  previousPeriod: z.object({
    income: z.string(),
    expense: z.string(),
    changePercent: z.number(),
  }),
});

export type StatsSummaryResponse = z.infer<typeof StatsSummaryResponseSchema>;

// ==========================================
// 2. STATS TIMESERIES
// ==========================================

export const TimeseriesGroupBySchema = z.enum(['day', 'week', 'month', 'year']);
export type TimeseriesGroupBy = z.infer<typeof TimeseriesGroupBySchema>;

export const StatsTimeseriesQuerySchema = z
  .object({
    groupBy: TimeseriesGroupBySchema.optional().default('day'),
    from: dateString,
    to: dateString,
  })
  .superRefine((v, ctx) => refineDateRange(v, ctx, STATS_MAX_RANGE_DAYS[v.groupBy]));

export type StatsTimeseriesQuery = z.infer<typeof StatsTimeseriesQuerySchema>;

export const StatsTimeseriesItemSchema = z.object({
  bucket: z.string(),
  income: z.string(),
  expense: z.string(),
  net: z.string(),
});

export type StatsTimeseriesItem = z.infer<typeof StatsTimeseriesItemSchema>;

export const StatsTimeseriesResponseSchema = z.object({
  data: z.array(StatsTimeseriesItemSchema),
  meta: z.object({
    groupBy: TimeseriesGroupBySchema,
    from: z.string(),
    to: z.string(),
    bucketCount: z.number(),
  }),
});

export type StatsTimeseriesResponse = z.infer<typeof StatsTimeseriesResponseSchema>;

// ==========================================
// 3. STATS BY CATEGORY
// ==========================================

export const StatsCategoryTypeSchema = z.enum(['EXPENSE', 'INCOME']);
export type StatsCategoryType = z.infer<typeof StatsCategoryTypeSchema>;

export const StatsByCategoryQuerySchema = z
  .object({
    type: StatsCategoryTypeSchema.optional().default('EXPENSE'),
    from: dateString,
    to: dateString,
  })
  .superRefine((v, ctx) => refineDateRange(v, ctx, STATS_MAX_RANGE_DAYS.any));

export type StatsByCategoryQuery = z.infer<typeof StatsByCategoryQuerySchema>;

export const CategoryStatsChildSchema = z.object({
  categoryId: z.string().nullable(),
  name: z.string(),
  amount: z.string(),
  percent: z.number(),
});

export type CategoryStatsChild = z.infer<typeof CategoryStatsChildSchema>;

export const CategoryStatsItemSchema = z.object({
  categoryId: z.string().nullable(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  amount: z.string(),
  percent: z.number(),
  count: z.number(),
  children: z.array(CategoryStatsChildSchema),
});

export type CategoryStatsItem = z.infer<typeof CategoryStatsItemSchema>;

export const StatsByCategoryResponseSchema = z.object({
  total: z.string(),
  items: z.array(CategoryStatsItemSchema),
});

export type StatsByCategoryResponse = z.infer<typeof StatsByCategoryResponseSchema>;

// ==========================================
// 4. STATS BY ACCOUNT
// ==========================================

export const StatsByAccountQuerySchema = z
  .object({
    from: dateString,
    to: dateString,
  })
  .superRefine((v, ctx) => refineDateRange(v, ctx, STATS_MAX_RANGE_DAYS.any));

export type StatsByAccountQuery = z.infer<typeof StatsByAccountQuerySchema>;

export const StatsByAccountItemSchema = z.object({
  accountId: z.string(),
  name: z.string(),
  type: z.string(),
  color: z.string(),
  icon: z.string(),
  income: z.string(),
  expense: z.string(),
  net: z.string(),
  balance: z.string(),
  transactionCount: z.number(),
});

export type StatsByAccountItem = z.infer<typeof StatsByAccountItemSchema>;

export const StatsByAccountResponseSchema = z.array(StatsByAccountItemSchema);
export type StatsByAccountResponse = z.infer<typeof StatsByAccountResponseSchema>;

// ==========================================
// 5. STATS BALANCE TREND
// ==========================================

export const StatsBalanceTrendQuerySchema = z
  .object({
    from: dateString,
    to: dateString,
  })
  // The trend is always daily, so it shares the daily bucket cap.
  .superRefine((v, ctx) => refineDateRange(v, ctx, STATS_MAX_RANGE_DAYS.day));

export type StatsBalanceTrendQuery = z.infer<typeof StatsBalanceTrendQuerySchema>;

export const StatsBalanceTrendItemSchema = z.object({
  date: z.string(),
  balance: z.string(),
  change: z.string(),
});

export type StatsBalanceTrendItem = z.infer<typeof StatsBalanceTrendItemSchema>;

export const StatsBalanceTrendResponseSchema = z.object({
  data: z.array(StatsBalanceTrendItemSchema),
  meta: z.object({
    from: z.string(),
    to: z.string(),
    startingBalance: z.string(),
    endingBalance: z.string(),
  }),
});

export type StatsBalanceTrendResponse = z.infer<typeof StatsBalanceTrendResponseSchema>;

// ==========================================
// 6. STATS DEBTS
// ==========================================

export const StatsDebtsResponseSchema = z.object({
  owedToMe: z.string(),
  iOwe: z.string(),
  net: z.string(),
  activeCount: z.number(),
  overdueCount: z.number(),
  overdueAmount: z.string(),
  partiallyPaidCount: z.number(),
  paidCount: z.number(),
});

export type StatsDebtsResponse = z.infer<typeof StatsDebtsResponseSchema>;

// ==========================================
// 7. STATS COMPARE
// ==========================================

export const StatsCompareQuerySchema = z
  .object({
    currentFrom: dateString,
    currentTo: dateString,
    previousFrom: dateString,
    previousTo: dateString,
  })
  .superRefine((v, ctx) => {
    refineDateRange({ from: v.currentFrom, to: v.currentTo }, ctx, STATS_MAX_RANGE_DAYS.any);
    refineDateRange({ from: v.previousFrom, to: v.previousTo }, ctx, STATS_MAX_RANGE_DAYS.any);
  });

export type StatsCompareQuery = z.infer<typeof StatsCompareQuerySchema>;

export const StatsComparePeriodSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  income: z.string(),
  expense: z.string(),
  net: z.string(),
  transactionCount: z.number(),
});

export type StatsComparePeriodSummary = z.infer<typeof StatsComparePeriodSummarySchema>;

export const StatsCompareCategoryItemSchema = z.object({
  categoryId: z.string().nullable(),
  name: z.string(),
  color: z.string(),
  icon: z.string(),
  currentAmount: z.string(),
  previousAmount: z.string(),
  change: z.string(),
  changePercent: z.number(),
});

export type StatsCompareCategoryItem = z.infer<typeof StatsCompareCategoryItemSchema>;

export const StatsCompareResponseSchema = z.object({
  current: StatsComparePeriodSummarySchema,
  previous: StatsComparePeriodSummarySchema,
  changes: z.object({
    incomeChange: z.string(),
    incomeChangePercent: z.number(),
    expenseChange: z.string(),
    expenseChangePercent: z.number(),
    netChange: z.string(),
    netChangePercent: z.number(),
  }),
  byCategory: z.array(StatsCompareCategoryItemSchema),
});

export type StatsCompareResponse = z.infer<typeof StatsCompareResponseSchema>;
