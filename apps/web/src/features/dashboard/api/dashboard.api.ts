import { api } from '../../../lib/api';
import {
  StatsSummaryResponse,
  StatsTimeseriesResponse,
  StatsByCategoryResponse,
  StatsBalanceTrendResponse,
  StatsDebtsResponse,
  TimeseriesGroupBy,
  StatsCategoryType,
} from '@fintrack/shared';

export interface DashboardStatsParams {
  from?: string;
  to?: string;
  groupBy?: TimeseriesGroupBy;
  type?: StatsCategoryType;
}

export const dashboardApi = {
  getSummary: async (params?: { from?: string; to?: string }): Promise<StatsSummaryResponse> => {
    const res = await api.get<{ data: StatsSummaryResponse }>('/stats/summary', { params });
    return res.data.data;
  },

  getTimeseries: async (params: {
    groupBy: TimeseriesGroupBy;
    from: string;
    to: string;
  }): Promise<StatsTimeseriesResponse> => {
    const res = await api.get<{ data: StatsTimeseriesResponse }>('/stats/timeseries', { params });
    return res.data.data;
  },

  getByCategory: async (params: {
    type?: StatsCategoryType;
    from: string;
    to: string;
  }): Promise<StatsByCategoryResponse> => {
    const res = await api.get<{ data: StatsByCategoryResponse }>('/stats/by-category', { params });
    return res.data.data;
  },

  getBalanceTrend: async (params: {
    from: string;
    to: string;
  }): Promise<StatsBalanceTrendResponse> => {
    const res = await api.get<{ data: StatsBalanceTrendResponse }>('/stats/balance-trend', { params });
    return res.data.data;
  },

  getDebts: async (): Promise<StatsDebtsResponse> => {
    const res = await api.get<{ data: StatsDebtsResponse }>('/stats/debts');
    return res.data.data;
  },
};
