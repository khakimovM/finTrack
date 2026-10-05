import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryResponse, ReorderCategoriesInput } from '@fintrack/shared';
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

/** Silent on failure: the form shows a taken name or a third level next to its field. */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      void invalidateAfter(queryClient, 'category');
      toast.success('Kategoriya qo‘shildi');
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
      toast.success('O‘zgarishlar saqlandi');
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

/**
 * Saved as soon as a row is dropped. The tree is reordered in the cache right away so the row
 * does not jump back while the request is on its way.
 */
export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReorderCategoriesInput) => categoriesApi.reorder(data),
    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.all() });
      const previous = queryClient.getQueryData<CategoryResponse[]>(queryKeys.categories.all());
      const rank = new Map(items.map((item) => [item.id, item.sortOrder]));
      const sort = (list: CategoryResponse[]): CategoryResponse[] =>
        [...list]
          .map((c) => ({ ...c, sortOrder: rank.get(c.id) ?? c.sortOrder, children: c.children && sort(c.children) }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      if (previous) queryClient.setQueryData(queryKeys.categories.all(), sort(previous));
      return { previous };
    },
    onSuccess: () => toast.success('Tartib saqlandi'),
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.categories.all(), context.previous);
      toast.error(apiErrorToMessage(err));
    },
    onSettled: () => void invalidateAfter(queryClient, 'category'),
  });
}
