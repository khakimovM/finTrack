export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
    sessions: () => ['auth', 'sessions'] as const,
    telegramLogin: (requestId: string) => ['auth', 'telegram-login', requestId] as const,
  },
  admin: {
    all: () => ['admin'] as const,
    session: () => ['admin', 'session'] as const,
    overview: () => ['admin', 'stats', 'overview'] as const,
    growth: (from: string, to: string, groupBy: string) => ['admin', 'stats', 'growth', from, to, groupBy] as const,
    retention: (cohorts: number) => ['admin', 'stats', 'retention', cohorts] as const,
    usage: (from: string, to: string) => ['admin', 'stats', 'usage', from, to] as const,
    funnel: (from: string, to: string) => ['admin', 'stats', 'funnel', from, to] as const,
    userLists: () => ['admin', 'users', 'list'] as const,
    userList: (query: object) => ['admin', 'users', 'list', query] as const,
    user: (id: string) => ['admin', 'users', 'detail', id] as const,
    system: () => ['admin', 'system'] as const,
    broadcastPreview: (segment: string, includeOptedOut: boolean) => ['admin', 'broadcasts', 'preview', segment, includeOptedOut] as const,
    broadcasts: (page: number) => ['admin', 'broadcasts', 'list', page] as const,
    audit: (query: object) => ['admin', 'audit', query] as const,
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
