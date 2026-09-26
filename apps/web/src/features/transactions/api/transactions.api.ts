import { api } from '../../../lib/api';
import {
  TransactionResponse,
  TransactionListMeta,
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
} from '@fintrack/shared';

export interface TransactionsListResponse {
  data: TransactionResponse[];
  meta: TransactionListMeta;
}

export const transactionsApi = {
  list: async (query?: Partial<ListTransactionsQuery>): Promise<TransactionsListResponse> => {
    const res = await api.get<TransactionsListResponse>('/transactions', { params: query });
    return res.data;
  },

  get: async (id: string): Promise<TransactionResponse> => {
    const res = await api.get<{ data: TransactionResponse }>(`/transactions/${id}`);
    return res.data.data;
  },

  create: async (data: CreateTransactionInput): Promise<TransactionResponse> => {
    const res = await api.post<{ data: { transaction: TransactionResponse } }>('/transactions', data);
    return res.data.data.transaction;
  },

  update: async (id: string, data: UpdateTransactionInput): Promise<TransactionResponse> => {
    const res = await api.patch<{ data: TransactionResponse }>(`/transactions/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    await api.post('/transactions/bulk-delete', { ids });
  },

  exportCsv: async (query?: Record<string, string | undefined>): Promise<Blob> => {
    const res = await api.get('/export/transactions.csv', {
      params: query,
      responseType: 'blob',
    });
    return res.data;
  },

  exportXlsx: async (query?: Record<string, string | undefined>): Promise<Blob> => {
    const res = await api.get('/export/transactions.xlsx', {
      params: query,
      responseType: 'blob',
    });
    return res.data;
  },
};

export function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}
