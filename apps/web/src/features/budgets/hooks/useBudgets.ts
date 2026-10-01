import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '../api/budgets.api';
import { CreateBudgetInput, UpdateBudgetInput } from '@fintrack/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';

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
      toast.success('Byudjet muvaffaqiyatli belgilandi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBudgetInput }) =>
      budgetsApi.update(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'budget');
      toast.success('Byudjet limiti yangilandi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'budget');
      toast.success('Byudjet o‘chirildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
