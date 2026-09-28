import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { StatsCompareResponse } from '@fintrack/shared';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { Comparison } from './periods';

/** Current vs previous period (under the `stats` root, so every money write refreshes it). */
export function useStatsCompare(comparison: Comparison | null) {
  const { current, previous } = comparison ?? {
    current: { from: '', to: '' },
    previous: { from: '', to: '' },
  };
  return useQuery({
    queryKey: queryKeys.stats.compare(current.from, current.to, previous.from, previous.to),
    queryFn: async () => {
      const res = await api.get<{ data: StatsCompareResponse }>('/stats/compare', {
        params: {
          currentFrom: current.from,
          currentTo: current.to,
          previousFrom: previous.from,
          previousTo: previous.to,
        },
      });
      return res.data.data;
    },
    enabled: comparison !== null,
    placeholderData: keepPreviousData,
  });
}
