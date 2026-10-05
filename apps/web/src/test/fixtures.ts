import { AccountResponse, CategoryResponse, DebtResponse, RecurringRuleResponse, TagResponse, TransactionResponse, UserResponse } from '@fintrack/shared';

let seq = 0;
/** Deterministic UUID-shaped ids for fixtures. */
export function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

export const cash = { id: '00000000-0000-4000-8000-00000000c0de', name: 'Naqd pul', icon: '💵' };

export function account(over: Partial<AccountResponse> = {}): AccountResponse {
  return {
    ...cash,
    type: 'CASH',
    currency: 'UZS',
    openingBalance: '0',
    balance: '10000000',
    color: '#10b981',
    isDefault: true,
    sortOrder: 1,
    archivedAt: null,
    transactionCount: 3,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

export function transaction(over: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    id: uuid(),
    type: 'EXPENSE',
    amount: '5000000',
    date: '2026-09-15',
    note: null,
    account: cash,
    category: { id: uuid(), name: 'Transport', icon: '🚗', color: '#f97316' },
    tags: [],
    debtId: null,
    debt: null,
    transferGroupId: null,
    transferPeer: null,
    createdAt: '2026-09-15T10:00:00.000Z',
    ...over,
  };
}

export function rule(over: Partial<RecurringRuleResponse> = {}): RecurringRuleResponse {
  return {
    id: uuid(),
    accountId: cash.id,
    categoryId: null,
    type: 'EXPENSE',
    amount: '150000000',
    frequency: 'MONTHLY',
    dayOfCycle: 5,
    startsAt: '2026-09-05',
    endsAt: null,
    nextRunAt: '2026-10-05',
    isActive: true,
    note: null,
    account: cash,
    category: { id: uuid(), name: 'Uy-joy', icon: '🏠', color: '#84cc16' },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

export function user(over: Partial<UserResponse> = {}): UserResponse {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    name: 'Aziz',
    email: null,
    telegramUsername: 'aziz',
    telegramLinked: true,
    phone: null,
    baseCurrency: 'UZS',
    locale: 'uz',
    timezone: 'Asia/Tashkent',
    strictMode: false,
    notifyTelegram: true,
    dailyDigest: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

export function category(over: Partial<CategoryResponse> = {}): CategoryResponse {
  return {
    id: uuid(),
    name: 'Oziq-ovqat',
    type: 'EXPENSE',
    icon: '🍔',
    color: '#2f9e68',
    parentId: null,
    isSystem: false,
    sortOrder: 0,
    children: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

export function tag(over: Partial<TagResponse> = {}): TagResponse {
  return { id: uuid(), name: 'oila', color: '#3d7bd6', transactionCount: 0, createdAt: '2026-09-01T00:00:00.000Z', ...over };
}

export function debt(over: Partial<DebtResponse> = {}): DebtResponse {
  return {
    id: uuid(),
    direction: 'I_LENT',
    personName: 'Jasur Karimov',
    personPhone: null,
    amount: '100000000',
    paidAmount: '0',
    remainingAmount: '100000000',
    dueDate: null,
    status: 'ACTIVE',
    paidAt: null,
    isOverdue: false,
    daysLeft: null,
    note: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}
