import { api } from '../../../lib/api';
import {
  AccountResponse,
  CreateAccountInput,
  UpdateAccountInput,
} from '@fintrack/shared';

export interface AccountsListResponse {
  data: AccountResponse[];
  meta: {
    totalBalance: string;
  };
}

export const accountsApi = {
  list: async (): Promise<AccountsListResponse> => {
    const res = await api.get<AccountsListResponse>('/accounts');
    return res.data;
  },

  create: async (data: CreateAccountInput): Promise<AccountResponse> => {
    const res = await api.post<{ data: AccountResponse }>('/accounts', data);
    return res.data.data;
  },

  update: async (id: string, data: UpdateAccountInput): Promise<AccountResponse> => {
    const res = await api.patch<{ data: AccountResponse }>(`/accounts/${id}`, data);
    return res.data.data;
  },

  archive: async (id: string): Promise<AccountResponse> => {
    const res = await api.post<{ data: AccountResponse }>(`/accounts/${id}/archive`);
    return res.data.data;
  },
};
