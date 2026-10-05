import type { DebtResponse, DebtStatus } from '@fintrack/shared';
import { formatDate } from '../../lib/format';

export type DebtFilter = 'all' | DebtStatus | 'overdue';

export const DEBT_FILTERS: { value: DebtFilter; label: string }[] = [
  { value: 'all', label: 'Barchasi' },
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'PARTIALLY_PAID', label: 'Qisman to‘langan' },
  { value: 'PAID', label: 'To‘langan' },
  { value: 'overdue', label: 'Muddati o‘tgan' },
];

export const DEBT_STATUS: Record<DebtStatus, { label: string; tone: 'info' | 'warning' | 'success' }> = {
  ACTIVE: { label: 'Faol', tone: 'info' },
  PARTIALLY_PAID: { label: 'Qisman to‘langan', tone: 'warning' },
  PAID: { label: 'To‘langan', tone: 'success' },
};

export function matchesFilter(debt: DebtResponse, filter: DebtFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'overdue') return debt.isOverdue;
  return debt.status === filter;
}

/** Open debts first, overdue ones on top, then by the nearest due date; no date goes last. */
export function sortDebts(debts: DebtResponse[]): DebtResponse[] {
  const due = (d: DebtResponse) => d.dueDate ?? '9999-12-31';
  return [...debts].sort(
    (a, b) =>
      Number(a.status === 'PAID') - Number(b.status === 'PAID') ||
      Number(b.isOverdue) - Number(a.isOverdue) ||
      due(a).localeCompare(due(b)),
  );
}

/** Whole percent of the original amount already paid back. */
export function paidPercent(debt: DebtResponse): number {
  const amount = BigInt(debt.amount);
  if (amount === 0n) return 0;
  return Number((BigInt(debt.paidAmount) * 100n) / amount);
}

export function dueText(debt: DebtResponse): string {
  return debt.dueDate ? `Muddat: ${formatDate(debt.dueDate)}` : 'Muddatsiz';
}

/** "Muddati o‘tgan!", or a warning for the last three days; nothing otherwise. */
export function dueChip(debt: DebtResponse): { label: string; tone: 'danger' | 'warning' } | null {
  if (debt.isOverdue) return { label: 'Muddati o‘tgan!', tone: 'danger' };
  if (debt.status === 'PAID' || debt.daysLeft === null || debt.daysLeft > 3) return null;
  return { label: debt.daysLeft === 0 ? 'Bugun' : `${debt.daysLeft} kun qoldi`, tone: 'warning' };
}
