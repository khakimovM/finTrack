import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transfersApi } from '../api/transfers.api';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transfersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all() });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('O‘tkazma muvaffaqiyatli amalga oshirildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
