import { api } from '../../../lib/api';
import {
  DebtResponse,
  DebtPaymentResponse,
  DebtListMeta,
  CreateDebtInput,
  UpdateDebtInput,
  CreateDebtPaymentInput,
  SettleDebtInput,
  ListDebtsQuery,
} from '@fintrack/shared';

export interface DebtsListResponse {
  data: DebtResponse[];
  meta: DebtListMeta;
}

export const debtsApi = {
  list: async (query?: Partial<ListDebtsQuery>): Promise<DebtsListResponse> => {
    const res = await api.get<DebtsListResponse>('/debts', { params: query });
    return res.data;
  },

  get: async (id: string): Promise<DebtResponse> => {
    const res = await api.get<{ data: DebtResponse }>(`/debts/${id}`);
    return res.data.data;
  },

  create: async (data: CreateDebtInput): Promise<DebtResponse> => {
    const res = await api.post<{ data: { debt: DebtResponse } }>('/debts', data);
    return res.data.data.debt;
  },

  update: async (id: string, data: UpdateDebtInput): Promise<DebtResponse> => {
    const res = await api.patch<{ data: DebtResponse }>(`/debts/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/debts/${id}`);
  },

  listPayments: async (id: string): Promise<DebtPaymentResponse[]> => {
    const res = await api.get<{ data: DebtPaymentResponse[] }>(`/debts/${id}/payments`);
    return res.data.data;
  },

  createPayment: async (
    id: string,
    data: CreateDebtPaymentInput,
  ): Promise<{ payment: DebtPaymentResponse; debt: DebtResponse }> => {
    const res = await api.post<{ data: { payment: DebtPaymentResponse; debt: DebtResponse } }>(
      `/debts/${id}/payments`,
      data,
    );
    return res.data.data;
  },

  settle: async (
    id: string,
    data: SettleDebtInput,
  ): Promise<{ payment: DebtPaymentResponse; debt: DebtResponse }> => {
    const res = await api.post<{ data: { payment: DebtPaymentResponse; debt: DebtResponse } }>(
      `/debts/${id}/settle`,
      data,
    );
    return res.data.data;
  },
};
