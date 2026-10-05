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

export interface PaymentResult {
  payment: DebtPaymentResponse;
  debt: DebtResponse;
}

export const debtsApi = {
  list: async (query?: Partial<ListDebtsQuery>): Promise<DebtsListResponse> => {
    const res = await api.get<DebtsListResponse>('/debts', { params: query });
    return res.data;
  },

  /** Every debt, page after page: the page filters and counts them itself. */
  listAll: async (): Promise<DebtsListResponse> => {
    const first = await debtsApi.list({ page: 1, limit: 100 });
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, first.meta.totalPages - 1) }, (_, i) => debtsApi.list({ page: i + 2, limit: 100 })),
    );
    return { data: [first, ...rest].flatMap((page) => page.data), meta: first.meta };
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

  /** Cancels the debt with its ledger rows; balances go back. */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/debts/${id}`);
  },

  listPayments: async (id: string): Promise<DebtPaymentResponse[]> => {
    const res = await api.get<{ data: DebtPaymentResponse[] }>(`/debts/${id}/payments`);
    return res.data.data;
  },

  createPayment: async (id: string, data: CreateDebtPaymentInput): Promise<PaymentResult> => {
    const res = await api.post<{ data: PaymentResult }>(`/debts/${id}/payments`, data);
    return res.data.data;
  },

  /** Pays whatever is left in one payment. */
  settle: async (id: string, data: SettleDebtInput): Promise<PaymentResult> => {
    const res = await api.post<{ data: PaymentResult }>(`/debts/${id}/settle`, data);
    return res.data.data;
  },

  deletePayment: async (id: string, paymentId: string): Promise<DebtResponse> => {
    const res = await api.delete<{ data: DebtResponse }>(`/debts/${id}/payments/${paymentId}`);
    return res.data.data;
  },
};
