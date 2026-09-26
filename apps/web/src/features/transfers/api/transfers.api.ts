import { api } from '../../../lib/api';
import { CreateTransferInput, TransferResponse } from '@fintrack/shared';

export const transfersApi = {
  create: async (data: CreateTransferInput): Promise<TransferResponse> => {
    const res = await api.post<{ data: TransferResponse }>('/transfers', data);
    return res.data.data;
  },

  delete: async (groupId: string): Promise<void> => {
    await api.delete(`/transfers/${groupId}`);
  },
};
