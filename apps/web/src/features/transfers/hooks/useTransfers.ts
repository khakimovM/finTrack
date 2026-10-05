import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTransferInput } from '@fintrack/shared';
import { transfersApi } from '../api/transfers.api';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';

/** Silent on success: the form shows its own toast; field errors stay inside the form. */
export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transfersApi.create,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'transfer');
      toast.success('O‘tkazma bajarildi');
    },
  });
}

export interface CancelTransferArgs {
  groupId: string;
  /** The transfer as it was, to book it again if the user presses "Qaytarish". */
  original?: CreateTransferInput;
}

/**
 * Removes both legs of a transfer at once (the API refuses to delete one leg alone). There is no
 * restore for transfers, so undo books the same transfer again.
 */
export function useDeleteTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId }: CancelTransferArgs) => transfersApi.delete(groupId),
    onSuccess: (_, { original }) => {
      void invalidateAfter(queryClient, 'transfer');
      if (!original) {
        toast.success('O‘tkazma bekor qilindi');
        return;
      }
      toast.undo('O‘tkazma bekor qilindi', () => {
        void transfersApi
          .create(original)
          .then(() => invalidateAfter(queryClient, 'transfer'))
          .catch((err: unknown) => toast.error(apiErrorToMessage(err)));
      });
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
