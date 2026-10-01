import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../api/categories.api';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { invalidateAfter } from '../../../lib/invalidation';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all(),
    queryFn: categoriesApi.tree,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'category');
      toast.success('Yangi kategoriya muvaffaqiyatli qo‘shildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof categoriesApi.update>[1] }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      void invalidateAfter(queryClient, 'category');
      toast.success('Kategoriya yangilandi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'category');
      toast.success('Kategoriya o‘chirildi');
    },
    onError: (err) => {
      toast.error(apiErrorToMessage(err));
    },
  });
}
