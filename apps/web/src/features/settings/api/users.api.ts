import {
  DeleteAccountInput,
  SessionResponse,
  TelegramLinkResponse,
  UpdateProfileInput,
  UserResponse,
} from '@fintrack/shared';
import { api } from '../../../lib/api';

export const usersApi = {
  updateProfile: async (input: UpdateProfileInput): Promise<UserResponse> => {
    const res = await api.patch<{ data: { user: UserResponse } }>('/users/me', input);
    return res.data.data.user;
  },

  sessions: async (): Promise<SessionResponse[]> => {
    const res = await api.get<{ data: SessionResponse[] }>('/users/me/sessions');
    return res.data.data;
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/users/me/sessions/${sessionId}`);
  },

  logoutAll: async (): Promise<void> => {
    await api.post('/auth/logout-all');
  },

  linkTelegram: async (): Promise<TelegramLinkResponse> => {
    const res = await api.post<{ data: TelegramLinkResponse }>('/users/me/telegram/link');
    return res.data.data;
  },

  deleteAccount: async (input: DeleteAccountInput): Promise<void> => {
    await api.delete('/users/me', { data: input });
  },
};
