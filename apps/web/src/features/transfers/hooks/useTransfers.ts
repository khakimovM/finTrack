import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transfersApi } from '../api/transfers.api';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transfersApi.create,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'transfer');
      toast.success('O‘tkazma muvaffaqiyatli amalga oshirildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

/** Removes both legs of a transfer at once (the API refuses to delete one leg alone). */
export function useDeleteTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transfersApi.delete,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'transfer');
      toast.success('O‘tkazma bekor qilindi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
