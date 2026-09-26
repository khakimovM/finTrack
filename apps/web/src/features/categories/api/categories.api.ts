import { api } from '../../../lib/api';
import {
  CategoryResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@fintrack/shared';

export const categoriesApi = {
  tree: async (): Promise<CategoryResponse[]> => {
    const res = await api.get<{ data: CategoryResponse[] }>('/categories');
    return res.data.data;
  },

  create: async (data: CreateCategoryInput): Promise<CategoryResponse> => {
    const res = await api.post<{ data: CategoryResponse }>('/categories', data);
    return res.data.data;
  },

  update: async (id: string, data: UpdateCategoryInput): Promise<CategoryResponse> => {
    const res = await api.patch<{ data: CategoryResponse }>(`/categories/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};
