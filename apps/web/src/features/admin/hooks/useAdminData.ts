import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  AdminAuditQuery,
  AdminStatsGroupBy,
  AdminUserDetail,
  AdminUsersExportQuery,
  AdminUsersQuery,
} from '@fintrack/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { apiErrorToMessage } from '../../../lib/apiError';
import { toast } from '../../../stores/toastStore';
import { adminApi, type AdminPeriod } from '../api/admin.api';

/** The panel's own numbers are cached for a minute on the server; no point asking more often. */
const STATS_STALE_MS = 60_000;

/** A 404 from the admin API means the admin session ended (it answers like an unknown URL). */
export function isAdminSessionGone(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function useAdminOverview() {
  return useQuery({ queryKey: queryKeys.admin.overview(), queryFn: adminApi.overview, staleTime: STATS_STALE_MS, retry: false });
}

export function useAdminGrowth(period: AdminPeriod, groupBy: AdminStatsGroupBy) {
  return useQuery({
    queryKey: queryKeys.admin.growth(period.from, period.to, groupBy),
    queryFn: () => adminApi.growth({ ...period, groupBy }),
    staleTime: STATS_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAdminRetention(cohorts: number) {
  return useQuery({
    queryKey: queryKeys.admin.retention(cohorts),
    queryFn: () => adminApi.retention(cohorts),
    staleTime: STATS_STALE_MS,
    retry: false,
  });
}

export function useAdminUsage(period: AdminPeriod) {
  return useQuery({
    queryKey: queryKeys.admin.usage(period.from, period.to),
    queryFn: () => adminApi.usage(period),
    staleTime: STATS_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAdminFunnel(period: AdminPeriod) {
  return useQuery({
    queryKey: queryKeys.admin.funnel(period.from, period.to),
    queryFn: () => adminApi.funnel(period),
    staleTime: STATS_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAdminUsers(query: Partial<AdminUsersQuery>) {
  return useQuery({
    queryKey: queryKeys.admin.userList(query),
    queryFn: () => adminApi.users(query),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.user(id ?? ''),
    queryFn: () => adminApi.user(id ?? ''),
    enabled: id !== null,
    retry: false,
  });
}

/** Refreshed every half minute while the page is open: it is where one looks when something is off. */
export function useAdminSystem() {
  return useQuery({ queryKey: queryKeys.admin.system(), queryFn: adminApi.system, refetchInterval: 30_000, retry: false });
}

export function useAdminAudit(query: Partial<AdminAuditQuery>) {
  return useQuery({
    queryKey: queryKeys.admin.audit(query),
    queryFn: () => adminApi.audit(query),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

type UserAction = { kind: 'ban'; id: string; reason: string } | { kind: 'unban'; id: string } | { kind: 'revoke'; id: string };

const DONE: Record<UserAction['kind'], string> = {
  ban: 'Foydalanuvchi bloklandi, barcha sessiyalari tugatildi',
  unban: 'Foydalanuvchi blokdan chiqarildi',
  revoke: 'Barcha sessiyalari tugatildi',
};

/** Ban, unban and "end every session": the person's card, the list and the audit log follow. */
export function useAdminUserAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: UserAction): Promise<AdminUserDetail | null> => {
      if (action.kind === 'ban') return adminApi.ban(action.id, action.reason);
      if (action.kind === 'unban') return adminApi.unban(action.id);
      await adminApi.revokeSessions(action.id);
      return null;
    },
    onSuccess: (detail, action) => {
      if (detail) queryClient.setQueryData(queryKeys.admin.user(action.id), detail);
      else void queryClient.invalidateQueries({ queryKey: queryKeys.admin.user(action.id) });
      // Lists only: the card already holds the answer, refetching it would just repeat the request.
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.userLists() });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(DONE[action.kind]);
    },
    onError: (error) => {
      if (isAdminSessionGone(error)) void queryClient.invalidateQueries({ queryKey: queryKeys.admin.session() });
      else toast.error(apiErrorToMessage(error));
    },
  });
}

export function useAdminUsersExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: Partial<AdminUsersExportQuery>) => adminApi.exportUsers(query),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
}
