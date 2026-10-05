import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { debtsApi } from '../api/debts.api';
import { ListDebtsQuery, CreateDebtInput, UpdateDebtInput, CreateDebtPaymentInput, SettleDebtInput } from '@fintrack/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';

export function useDebts(filters?: Partial<ListDebtsQuery>) {
  return useQuery({
    queryKey: queryKeys.debts.list(filters),
    queryFn: () => debtsApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** The debts page: all of them, both directions, filtered and counted on the client. */
export function useAllDebts() {
  return useQuery({
    queryKey: [...queryKeys.debts.list(), 'all'],
    queryFn: debtsApi.listAll,
    staleTime: 15_000,
  });
}

export function useDebtPayments(debtId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.debts.payments(debtId),
    queryFn: () => debtsApi.listPayments(debtId),
    enabled: options.enabled ?? true,
  });
}

/** Silent on failure: the forms show field errors (overpayment, strict mode) themselves. */
export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDebtInput) => debtsApi.create(data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debt');
      toast.success('Qarz qo‘shildi');
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDebtInput }) => debtsApi.update(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debt');
      toast.success('O‘zgarishlar saqlandi');
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => debtsApi.delete(id),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debt');
      toast.success('Qarz o‘chirildi');
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}

export function useCreateDebtPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateDebtPaymentInput }) => debtsApi.createPayment(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debtPayment');
      toast.success('To‘lov kiritildi');
    },
  });
}

export function useSettleDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SettleDebtInput }) => debtsApi.settle(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debtPayment');
      toast.success('Qarz yopildi');
    },
  });
}

export function useDeleteDebtPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, paymentId }: { debtId: string; paymentId: string }) => debtsApi.deletePayment(debtId, paymentId),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debtPayment');
      toast.success('To‘lov o‘chirildi');
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}
