import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { recurringApi } from '../recurring.api';
import { CreateRecurringRuleInput, UpdateRecurringRuleInput } from '@fintrack/shared';
import { invalidateAfter } from '../../../lib/invalidation';

export const recurringKeys = {
  all: ['recurring'] as const,
  list: (isActive?: boolean) => [...recurringKeys.all, 'list', { isActive }] as const,
  detail: (id: string) => [...recurringKeys.all, 'detail', id] as const,
};

export function useRecurringRules(isActive?: boolean) {
  return useQuery({
    queryKey: recurringKeys.list(isActive),
    queryFn: () => recurringApi.list(isActive),
  });
}

export function useCreateRecurringRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecurringRuleInput) => recurringApi.create(data),
    onSuccess: () => {
      toast.success('Takrorlanuvchi to‘lov qoidasi yaratildi');
      void invalidateAfter(queryClient, 'recurringRun');
    },
    onError: (err: unknown) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecurringRuleInput }) =>
      recurringApi.update(id, data),
    onSuccess: () => {
      toast.success('Takrorlanuvchi to‘lov qoidasi yangilandi');
      void invalidateAfter(queryClient, 'recurring');
    },
    onError: (err: unknown) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recurringApi.delete(id),
    onSuccess: () => {
      toast.success('Takrorlanuvchi to‘lov qoidasi o‘chirildi');
      void invalidateAfter(queryClient, 'recurring');
    },
    onError: (err: unknown) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useRunNowRecurringRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recurringApi.runNow(id),
    onSuccess: (data) => {
      toast.success('Tranzaksiya muvaffaqiyatli yaratildi');
      void invalidateAfter(queryClient, 'recurringRun');
      return data;
    },
    onError: (err: unknown) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
