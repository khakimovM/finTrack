import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReorderAccountsInput } from '@fintrack/shared';
import { accountsApi } from '../api/accounts.api';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';
import { t } from '../../../lib/i18n';

/** Active accounts: what every picker offers. */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.all(),
    queryFn: () => accountsApi.list(),
  });
}

/** Active and archived together, for the accounts page and its "Arxiv" tab. */
export function useAccountsWithArchived() {
  return useQuery({
    queryKey: [...queryKeys.accounts.all(), 'withArchived'],
    queryFn: () => accountsApi.list(true),
  });
}

/** Silent on failure: the form shows a taken name next to the field. */
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'account');
      toast.success(t('accounts.toast.added'));
    },
  });
}

export function useUpdateAccount({ silent = false }: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof accountsApi.update>[1] }) =>
      accountsApi.update(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'account');
      if (!silent) toast.success(t('transactions.toast.changesSaved'));
    },
  });
}

/** Archive or bring back; LAST_ACCOUNT is answered by the page with its own dialog. */
export function useToggleArchiveAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountsApi.toggleArchive,
    onSuccess: (account) => {
      void invalidateAfter(queryClient, 'account');
      toast.success(account.archivedAt ? t('accounts.toast.archived') : t('accounts.toast.unarchived'));
    },
  });
}

/** ACCOUNT_HAS_HISTORY and LAST_ACCOUNT are answered by the page with their own dialogs. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountsApi.delete,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'account');
      toast.success(t('accounts.toast.deleted'));
    },
  });
}

export function useReorderAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReorderAccountsInput) => accountsApi.reorder(data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'account');
      toast.success(t('accounts.toast.orderSaved'));
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
