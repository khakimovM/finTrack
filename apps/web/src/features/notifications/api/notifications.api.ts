import { api } from '../../../lib/api';
import { NotificationListResponse, NotificationResponse } from '@fintrack/shared';

export const notificationsApi = {
  list: async (unreadOnly?: boolean): Promise<NotificationListResponse> => {
    const res = await api.get<NotificationListResponse>('/notifications', {
      params: { unreadOnly, limit: 30 },
    });
    return res.data;
  },

  markAsRead: async (id: string): Promise<NotificationResponse> => {
    const res = await api.patch<{ data: NotificationResponse }>(`/notifications/${id}/read`);
    return res.data.data;
  },

  markAllAsRead: async (): Promise<{ updatedCount: number }> => {
    const res = await api.post<{ data: { updatedCount: number } }>('/notifications/read-all');
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/notifications/${id}`);
  },
};
