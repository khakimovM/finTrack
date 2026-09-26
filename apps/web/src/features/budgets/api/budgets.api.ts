import { api } from '../../../lib/api';
import {
  BudgetResponse,
  BudgetStatusResponse,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '@fintrack/shared';

export const budgetsApi = {
  list: async (month?: string): Promise<BudgetResponse[]> => {
    const res = await api.get<{ data: BudgetResponse[] }>('/budgets', { params: { month } });
    return res.data.data;
  },

  getStatus: async (month?: string): Promise<BudgetStatusResponse> => {
    const res = await api.get<BudgetStatusResponse>('/budgets/status', { params: { month } });
    return res.data;
  },

  create: async (data: CreateBudgetInput): Promise<BudgetResponse> => {
    const res = await api.post<{ data: BudgetResponse }>('/budgets', data);
    return res.data.data;
  },

  update: async (id: string, data: UpdateBudgetInput): Promise<BudgetResponse> => {
    const res = await api.patch<{ data: BudgetResponse }>(`/budgets/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/budgets/${id}`);
  },
};
