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

/** Active and paused rules together; the page splits them into its two tabs. */
export function useRecurringRules() {
  return useQuery({
    queryKey: recurringKeys.list(),
    queryFn: () => recurringApi.list(),
  });
}

/** Silent on failure: the form shows why (strict mode, dates) next to its fields. */
export function useCreateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringRuleInput) => recurringApi.create(data),
    onSuccess: () => {
      toast.success('Qoida yaratildi');
      // A rule due today is booked at once.
      void invalidateAfter(queryClient, 'recurringRun');
    },
  });
}

export function useUpdateRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecurringRuleInput }) => recurringApi.update(id, data),
    onSuccess: () => {
      toast.success('Qoida saqlandi');
      void invalidateAfter(queryClient, 'recurring');
    },
  });
}

export function usePauseRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => recurringApi.update(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? 'Qoida davom ettirildi' : 'Qoida to‘xtatildi');
      // Resuming may book today's payment.
      void invalidateAfter(queryClient, isActive ? 'recurringRun' : 'recurring');
    },
    onError: (err: unknown) => toast.error(apiErrorToMessage(err)),
  });
}

export function useDeleteRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringApi.delete(id),
    onSuccess: () => {
      toast.success('Qoida o‘chirildi');
      void invalidateAfter(queryClient, 'recurring');
    },
    onError: (err: unknown) => toast.error(apiErrorToMessage(err)),
  });
}

export function useRunNowRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringApi.runNow(id),
    onSuccess: () => {
      toast.success('To‘lov yozildi');
      void invalidateAfter(queryClient, 'recurringRun');
    },
    onError: (err: unknown) => toast.error(apiErrorToMessage(err)),
  });
}
