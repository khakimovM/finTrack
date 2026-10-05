import { api } from '../../../lib/api';
import {
  AccountResponse,
  CreateAccountInput,
  ReorderAccountsInput,
  UpdateAccountInput,
} from '@fintrack/shared';

export interface AccountsListResponse {
  data: AccountResponse[];
  meta: {
    totalBalance: string;
  };
}

export const accountsApi = {
  /** Active accounts only, unless `includeArchived` (the "Arxiv" tab). */
  list: async (includeArchived = false): Promise<AccountsListResponse> => {
    const res = await api.get<AccountsListResponse>('/accounts', {
      params: includeArchived ? { includeArchived: 'true' } : undefined,
    });
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

  /** Archives an active account, or brings an archived one back. */
  toggleArchive: async (id: string): Promise<AccountResponse> => {
    const res = await api.post<{ data: AccountResponse }>(`/accounts/${id}/archive`);
    return res.data.data;
  },

  /** Only accounts without history; others answer 409 ACCOUNT_HAS_HISTORY. */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/accounts/${id}`);
  },

  reorder: async (data: ReorderAccountsInput): Promise<void> => {
    await api.patch('/accounts/reorder', data);
  },
};
