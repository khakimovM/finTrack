import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { recurringApi } from '../recurring.api';
import {
  CreateRecurringRuleInput,
  UpdateRecurringRuleInput,
} from '@fintrack/shared';

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
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
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
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
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
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
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
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      return data;
    },
    onError: (err: unknown) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
