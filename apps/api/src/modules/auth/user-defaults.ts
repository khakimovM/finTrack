import { AccountType, CategoryType } from '@prisma/client';

export interface DefaultCategory {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sortOrder: number;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Oziq-ovqat', type: CategoryType.EXPENSE, icon: '🍔', color: '#ef4444', sortOrder: 1 },
  { name: 'Transport', type: CategoryType.EXPENSE, icon: '🚗', color: '#f97316', sortOrder: 2 },
  { name: 'Uy-joy', type: CategoryType.EXPENSE, icon: '🏠', color: '#84cc16', sortOrder: 3 },
  { name: 'Kommunal', type: CategoryType.EXPENSE, icon: '💡', color: '#eab308', sortOrder: 4 },
  { name: 'Kiyim', type: CategoryType.EXPENSE, icon: '👕', color: '#06b6d4', sortOrder: 5 },
  { name: 'Sog‘liq', type: CategoryType.EXPENSE, icon: '🏥', color: '#ec4899', sortOrder: 6 },
  { name: 'Ko‘ngilochar', type: CategoryType.EXPENSE, icon: '🎬', color: '#8b5cf6', sortOrder: 7 },
  { name: 'Taʼlim', type: CategoryType.EXPENSE, icon: '📚', color: '#3b82f6', sortOrder: 8 },
  { name: 'Oylik', type: CategoryType.INCOME, icon: '💼', color: '#10b981', sortOrder: 9 },
  { name: 'Qo‘shimcha daromad', type: CategoryType.INCOME, icon: '💵', color: '#14b8a6', sortOrder: 10 },
];

export const DEFAULT_ACCOUNT = {
  name: 'Naqd pul',
  type: AccountType.CASH,
  currency: 'UZS',
  icon: '💵',
  color: '#10b981',
  sortOrder: 1,
} as const;
