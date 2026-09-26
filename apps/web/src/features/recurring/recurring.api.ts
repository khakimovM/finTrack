import { api } from '../../lib/api';
import {
  RecurringRuleResponse,
  CreateRecurringRuleInput,
  UpdateRecurringRuleInput,
  TransactionResponse,
} from '@fintrack/shared';

export const recurringApi = {
  list: async (isActive?: boolean): Promise<RecurringRuleResponse[]> => {
    const res = await api.get<{ data: RecurringRuleResponse[] }>('/recurring', {
      params: isActive !== undefined ? { isActive: String(isActive) } : undefined,
    });
    return res.data.data;
  },

  get: async (id: string): Promise<RecurringRuleResponse> => {
    const res = await api.get<{ data: RecurringRuleResponse }>(`/recurring/${id}`);
    return res.data.data;
  },

  create: async (data: CreateRecurringRuleInput): Promise<RecurringRuleResponse> => {
    const res = await api.post<{ data: RecurringRuleResponse }>('/recurring', data);
    return res.data.data;
  },

  update: async (id: string, data: UpdateRecurringRuleInput): Promise<RecurringRuleResponse> => {
    const res = await api.patch<{ data: RecurringRuleResponse }>(`/recurring/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/recurring/${id}`);
  },

  runNow: async (
    id: string,
  ): Promise<{ transaction: TransactionResponse; rule: RecurringRuleResponse }> => {
    const res = await api.post<{
      data: { transaction: TransactionResponse; rule: RecurringRuleResponse };
    }>(`/recurring/${id}/run-now`);
    return res.data.data;
  },
};
