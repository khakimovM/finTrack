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

export function useDebt(id?: string) {
  return useQuery({
    queryKey: queryKeys.debts.detail(id ?? ''),
    queryFn: () => debtsApi.get(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useDebtPayments(debtId?: string) {
  return useQuery({
    queryKey: queryKeys.debts.payments(debtId ?? ''),
    queryFn: () => debtsApi.listPayments(debtId ?? ''),
    enabled: Boolean(debtId),
  });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDebtInput) => debtsApi.create(data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debt');
      toast.success('Qarz muvaffaqiyatli qo‘shildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDebtInput }) =>
      debtsApi.update(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debt');
      toast.success('Qarz ma’lumotlari yangilandi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => debtsApi.delete(id),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debt');
      toast.success('Qarz o‘chirildi va balans tiklandi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useCreateDebtPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateDebtPaymentInput }) =>
      debtsApi.createPayment(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debtPayment');
      toast.success('To‘lov muvaffaqiyatli qabul qilindi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useSettleDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SettleDebtInput }) =>
      debtsApi.settle(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'debtPayment');
      toast.success('Qarz to‘liq yopildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
