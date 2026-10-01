export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
    sessions: () => ['auth', 'sessions'] as const,
    telegramLogin: (requestId: string) => ['auth', 'telegram-login', requestId] as const,
  },
  accounts: {
    all: () => ['accounts'] as const,
    detail: (id: string) => ['accounts', id] as const,
  },
  categories: {
    all: () => ['categories'] as const,
    detail: (id: string) => ['categories', id] as const,
  },
  tags: {
    all: () => ['tags'] as const,
  },
  transactions: {
    list: (filters?: Record<string, unknown>) => ['transactions', filters ?? {}] as const,
    detail: (id: string) => ['transactions', id] as const,
  },
  debts: {
    list: (filters?: Record<string, unknown>) => ['debts', filters ?? {}] as const,
    detail: (id: string) => ['debts', id] as const,
    payments: (id: string) => ['debts', id, 'payments'] as const,
  },
  stats: {
    summary: (from?: string, to?: string) => ['stats', 'summary', { from, to }] as const,
    timeseries: (groupBy?: string, from?: string, to?: string) =>
      ['stats', 'timeseries', { groupBy, from, to }] as const,
    byCategory: (type?: string, from?: string, to?: string) =>
      ['stats', 'by-category', { type, from, to }] as const,
    byAccount: (from?: string, to?: string) => ['stats', 'by-account', { from, to }] as const,
    balanceTrend: (from?: string, to?: string) => ['stats', 'balance-trend', { from, to }] as const,
    debts: () => ['stats', 'debts'] as const,
    compare: (
      currentFrom?: string,
      currentTo?: string,
      previousFrom?: string,
      previousTo?: string,
    ) => ['stats', 'compare', { currentFrom, currentTo, previousFrom, previousTo }] as const,
  },
  budgets: {
    list: (month?: string) => ['budgets', 'list', { month }] as const,
    status: (month?: string) => ['budgets', 'status', { month }] as const,
  },
  notifications: {
    list: (unreadOnly?: boolean) => ['notifications', { unreadOnly }] as const,
  },
};
