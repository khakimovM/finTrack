import axios from 'axios';
import {
  AdminSessionResponse,
  TelegramLoginStartResponse,
  TelegramLoginStatusResponse,
  VerifyTelegramLoginInput,
} from '@fintrack/shared';
import { api } from '../../../lib/api';
import type { TelegramLoginApi } from '../../auth/hooks/useTelegramLogin';

/**
 * Admin sign-in and session. The admin API answers 404 to anyone without an admin session,
 * exactly like an unknown URL; for `me` that simply means "not signed in".
 */
export const adminAuthApi = {
  start: async (): Promise<TelegramLoginStartResponse> => {
    const res = await api.post<{ data: TelegramLoginStartResponse }>('/admin/auth/telegram/start');
    return res.data.data;
  },

  status: async (requestId: string): Promise<TelegramLoginStatusResponse> => {
    const res = await api.get<{ data: TelegramLoginStatusResponse }>(`/admin/auth/telegram/status/${requestId}`);
    return res.data.data;
  },

  verify: async (input: VerifyTelegramLoginInput): Promise<AdminSessionResponse> => {
    const res = await api.post<{ data: AdminSessionResponse }>('/admin/auth/telegram/verify', input);
    return res.data.data;
  },

  resend: async (requestId: string): Promise<TelegramLoginStatusResponse> => {
    const res = await api.post<{ data: TelegramLoginStatusResponse }>('/admin/auth/telegram/resend', { requestId });
    return res.data.data;
  },

  me: async (): Promise<AdminSessionResponse | null> => {
    try {
      const res = await api.get<{ data: AdminSessionResponse }>('/admin/auth/me');
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  },

  logout: async (): Promise<void> => {
    await api.post('/admin/auth/logout');
  },
};

export const adminLoginApi: TelegramLoginApi<AdminSessionResponse> = {
  start: adminAuthApi.start,
  status: adminAuthApi.status,
  verify: adminAuthApi.verify,
  resend: adminAuthApi.resend,
};
