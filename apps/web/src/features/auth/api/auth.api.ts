import {
  TelegramLoginStartResponse,
  TelegramLoginStatusResponse,
  UserResponse,
  VerifyTelegramLoginInput,
} from '@fintrack/shared';
import { api } from '../../../lib/api';

export const authApi = {
  startTelegramLogin: async (): Promise<TelegramLoginStartResponse> => {
    const res = await api.post<{ data: TelegramLoginStartResponse }>('/auth/telegram/start');
    return res.data.data;
  },

  telegramLoginStatus: async (requestId: string): Promise<TelegramLoginStatusResponse> => {
    const res = await api.get<{ data: TelegramLoginStatusResponse }>(`/auth/telegram/status/${requestId}`);
    return res.data.data;
  },

  verifyTelegramLogin: async (input: VerifyTelegramLoginInput): Promise<UserResponse> => {
    const res = await api.post<{ data: { user: UserResponse } }>('/auth/telegram/verify', input);
    return res.data.data.user;
  },

  resendTelegramCode: async (requestId: string): Promise<TelegramLoginStatusResponse> => {
    const res = await api.post<{ data: TelegramLoginStatusResponse }>('/auth/telegram/resend', { requestId });
    return res.data.data;
  },
};
