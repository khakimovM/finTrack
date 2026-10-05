import { useInfiniteQuery, useMutation, useQuery, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions.api';
import { ListTransactionsQuery, UpdateTransactionInput } from '@fintrack/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';

export function useTransactions(filters?: Partial<ListTransactionsQuery>, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () => transactionsApi.list(filters),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** Phones: pages are appended ("Yana yuklash") instead of replaced. */
export function useInfiniteTransactions(filters: Omit<Partial<ListTransactionsQuery>, 'page'>, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.transactions.list(filters), 'infinite'],
    queryFn: ({ pageParam }) => transactionsApi.list({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: options.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'transaction');
      toast.success('Tranzaksiya saqlandi');
    },
    // Strict-mode and validation errors are shown inside the form.
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionInput }) => transactionsApi.update(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'transaction');
      toast.success('O‘zgarishlar saqlandi');
    },
  });
}

/** Six seconds to take a delete back: the rows are restored one by one. */
function offerUndo(queryClient: QueryClient, ids: string[], message: string) {
  toast.undo(message, () => {
    void Promise.all(ids.map((id) => transactionsApi.restore(id)))
      .then(() => invalidateAfter(queryClient, 'transaction'))
      .catch((err: unknown) => toast.error(apiErrorToMessage(err)));
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: (_, id) => {
      void invalidateAfter(queryClient, 'transaction');
      offerUndo(queryClient, [id], 'Tranzaksiya o‘chirildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useBulkDeleteTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transactionsApi.bulkDelete,
    onSuccess: (_, ids) => {
      void invalidateAfter(queryClient, 'transaction');
      offerUndo(queryClient, ids, `${ids.length} ta tranzaksiya o‘chirildi`);
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
