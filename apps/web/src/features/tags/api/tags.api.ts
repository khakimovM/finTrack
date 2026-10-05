import { api } from '../../../lib/api';
import type { CreateTagInput, TagResponse, UpdateTagInput } from '@fintrack/shared';

export const tagsApi = {
  list: async (): Promise<TagResponse[]> => {
    const res = await api.get<{ data: TagResponse[] }>('/tags');
    return res.data.data;
  },

  create: async (data: CreateTagInput): Promise<TagResponse> => {
    const res = await api.post<{ data: TagResponse }>('/tags', data);
    return res.data.data;
  },

  update: async ({ id, data }: { id: string; data: UpdateTagInput }): Promise<TagResponse> => {
    const res = await api.patch<{ data: TagResponse }>(`/tags/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tags/${id}`);
  },
};
