import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { invalidateAfter } from '../../../lib/invalidation';
import { apiErrorToMessage } from '../../../lib/apiError';
import { toast } from '../../../stores/toastStore';
import { tagsApi } from '../api/tags.api';

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags.all(), queryFn: tagsApi.list, staleTime: 60_000 });
}

/** Silent on success: the caller decides whether to say "Teg yaratildi". */
export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => void invalidateAfter(queryClient, 'tag'),
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.update,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'tag');
      toast.success('Teg saqlandi');
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'tag');
      toast.success('Teg o‘chirildi');
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}
