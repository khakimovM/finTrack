import { keepPreviousData, useQueries } from '@tanstack/react-query';
import type { CategoryStatsItem, StatsCategoryType } from '@fintrack/shared';
import { queryKeys } from '../../lib/queryKeys';
import { dashboardApi } from '../dashboard/api/dashboard.api';
import { useStatsCompare } from './useStatsCompare';
import type { Comparison } from './periods';
import type { BucketPlan } from './buckets';

export interface CategoryChange {
  id: string;
  name: string;
  icon: string;
  color: string;
  current: bigint;
  previous: bigint;
}

/** Parent categories of both periods side by side, the biggest now first. */
export function mergeCategories(current: CategoryStatsItem[], previous: CategoryStatsItem[]): CategoryChange[] {
  const rows = new Map<string, CategoryChange>();
  const add = (items: CategoryStatsItem[], key: 'current' | 'previous') => {
    for (const item of items) {
      const id = item.categoryId ?? 'none';
      const row = rows.get(id) ?? { id, name: item.name, icon: item.icon, color: item.color, current: 0n, previous: 0n };
      row[key] += BigInt(item.amount);
      rows.set(id, row);
    }
  };
  add(current, 'current');
  add(previous, 'previous');
  const order = (a: bigint, b: bigint) => (a === b ? 0 : a > b ? -1 : 1);
  return [...rows.values()].sort((a, b) => order(a.current, b.current) || order(a.previous, b.previous));
}

/**
 * Everything the reports page shows: the totals (/stats/compare), both periods day by day or
 * month by month for the chart, and income and expense by category for both. All keys live under
 * `stats`, so any money write refreshes the report.
 */
export function useReport(comparison: Comparison | null, plan: BucketPlan | null) {
  const compare = useStatsCompare(comparison);
  const periods = comparison ? [comparison.current, comparison.previous] : [];
  const series = useQueries({
    queries: periods.map((range) => ({
      queryKey: queryKeys.stats.timeseries(plan?.groupBy, range.from, range.to),
      queryFn: () => dashboardApi.getTimeseries({ groupBy: plan?.groupBy ?? 'day', from: range.from, to: range.to }),
      enabled: plan !== null,
      placeholderData: keepPreviousData,
    })),
  });
  const types: StatsCategoryType[] = ['EXPENSE', 'INCOME'];
  const categories = useQueries({
    queries: types.flatMap((type) =>
      periods.map((range) => ({
        queryKey: queryKeys.stats.byCategory(type, range.from, range.to),
        queryFn: () => dashboardApi.getByCategory({ type, from: range.from, to: range.to }),
        placeholderData: keepPreviousData,
      })),
    ),
  });

  const all = [compare, ...series, ...categories];
  const ready = comparison !== null && all.every((q) => q.data !== undefined);
  return {
    isLoading: comparison !== null && all.some((q) => q.isLoading),
    isError: all.some((q) => q.isError),
    refetch: () => all.forEach((q) => void q.refetch()),
    compare: compare.data,
    series: ready ? { current: series[0].data?.data ?? [], previous: series[1].data?.data ?? [] } : undefined,
    expense: ready ? mergeCategories(categories[0].data?.items ?? [], categories[1].data?.items ?? []) : [],
    income: ready ? mergeCategories(categories[2].data?.items ?? [], categories[3].data?.items ?? []) : [],
  };
}
