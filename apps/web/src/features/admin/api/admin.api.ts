import {
  AdminAuditQuery,
  AdminAuditResponse,
  AdminFunnelResponse,
  AdminGrowthResponse,
  AdminOverviewResponse,
  AdminRetentionResponse,
  AdminRevokeSessionsResponse,
  AdminStatsGroupBy,
  AdminSystemResponse,
  AdminUsageResponse,
  AdminUserDetail,
  AdminUsersExportQuery,
  AdminUsersQuery,
  AdminUsersResponse,
} from '@fintrack/shared';
import { api } from '../../../lib/api';

export interface AdminPeriod {
  from: string;
  to: string;
}

/** Drops empty filters so the URL (and the query key) only carries what was chosen. */
function params<T extends object>(query: T): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
}

async function get<T>(path: string, query?: object): Promise<T> {
  const res = await api.get<{ data: T }>(path, { params: query ? params(query) : undefined });
  return res.data.data;
}

/** The owner's panel (docs/09). Every endpoint answers 404 without an admin session. */
export const adminApi = {
  overview: () => get<AdminOverviewResponse>('/admin/stats/overview'),
  growth: (period: AdminPeriod & { groupBy: AdminStatsGroupBy }) => get<AdminGrowthResponse>('/admin/stats/growth', period),
  retention: (cohorts: number) => get<AdminRetentionResponse>('/admin/stats/retention', { cohorts }),
  usage: (period: AdminPeriod) => get<AdminUsageResponse>('/admin/stats/usage', period),
  funnel: (period: AdminPeriod) => get<AdminFunnelResponse>('/admin/stats/funnel', period),

  users: async (query: Partial<AdminUsersQuery>): Promise<AdminUsersResponse> => {
    const res = await api.get<AdminUsersResponse>('/admin/users', { params: params(query) });
    return res.data;
  },
  user: (id: string) => get<AdminUserDetail>(`/admin/users/${id}`),
  ban: async (id: string, reason: string): Promise<AdminUserDetail> => {
    const res = await api.post<{ data: AdminUserDetail }>(`/admin/users/${id}/ban`, { reason });
    return res.data.data;
  },
  unban: async (id: string): Promise<AdminUserDetail> => {
    const res = await api.post<{ data: AdminUserDetail }>(`/admin/users/${id}/unban`);
    return res.data.data;
  },
  revokeSessions: async (id: string): Promise<AdminRevokeSessionsResponse> => {
    const res = await api.post<{ data: AdminRevokeSessionsResponse }>(`/admin/users/${id}/revoke-sessions`);
    return res.data.data;
  },
  exportUsers: async (query: Partial<AdminUsersExportQuery>): Promise<Blob> => {
    const res = await api.get<Blob>('/admin/users/export.csv', { params: params(query), responseType: 'blob' });
    return res.data;
  },

  system: () => get<AdminSystemResponse>('/admin/system'),
  audit: async (query: Partial<AdminAuditQuery>): Promise<AdminAuditResponse> => {
    const res = await api.get<AdminAuditResponse>('/admin/audit', { params: params(query) });
    return res.data;
  },
};
