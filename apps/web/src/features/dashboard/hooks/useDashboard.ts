import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { dashboardApi } from '../api/dashboard.api';
import { usePeriodStore } from '../../../stores/periodStore';
import { StatsCategoryType } from '@fintrack/shared';

export function useStatsSummary() {
  const { from, to } = usePeriodStore();

  return useQuery({
    queryKey: queryKeys.stats.summary(from, to),
    queryFn: () => dashboardApi.getSummary({ from, to }),
  });
}

export function useStatsTimeseries() {
  const { from, to, groupBy } = usePeriodStore();

  return useQuery({
    queryKey: queryKeys.stats.timeseries(groupBy, from, to),
    queryFn: () => dashboardApi.getTimeseries({ groupBy, from, to }),
    enabled: Boolean(from && to),
  });
}

export function useStatsByCategory(type: StatsCategoryType = 'EXPENSE') {
  const { from, to } = usePeriodStore();

  return useQuery({
    queryKey: queryKeys.stats.byCategory(type, from, to),
    queryFn: () => dashboardApi.getByCategory({ type, from, to }),
    enabled: Boolean(from && to),
  });
}

export function useStatsBalanceTrend() {
  const { from, to } = usePeriodStore();

  return useQuery({
    queryKey: queryKeys.stats.balanceTrend(from, to),
    queryFn: () => dashboardApi.getBalanceTrend({ from, to }),
    enabled: Boolean(from && to),
  });
}

export function useStatsDebts() {
  return useQuery({
    queryKey: queryKeys.stats.debts(),
    queryFn: () => dashboardApi.getDebts(),
  });
}
