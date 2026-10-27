import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '../api/budgets.api';
import { CreateBudgetInput, UpdateBudgetInput } from '@fintrack/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';
import { t } from '../../../lib/i18n';

export function useBudgetsStatus(month?: string) {
  return useQuery({
    queryKey: queryKeys.budgets.status(month),
    queryFn: () => budgetsApi.getStatus(month),
    staleTime: 15_000,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBudgetInput) => budgetsApi.create(data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'budget');
      toast.success(t('budgets.toast.added'));
    },
    // A budget the month already has is shown next to the category in the form.
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBudgetInput }) =>
      budgetsApi.update(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'budget');
      toast.success(t('budgets.toast.saved'));
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'budget');
      toast.success(t('budgets.toast.deleted'));
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
