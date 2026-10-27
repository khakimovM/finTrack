import type { DebtResponse, DebtStatus } from '@fintrack/shared';
import { formatDate } from '../../lib/format';
import { t, tn, type TextKey } from '../../lib/i18n';

export type DebtFilter = 'all' | DebtStatus | 'overdue';

export const DEBT_FILTERS: { value: DebtFilter; label: TextKey }[] = [
  { value: 'all', label: 'debts.filters.all' },
  { value: 'ACTIVE', label: 'debts.filters.ACTIVE' },
  { value: 'PARTIALLY_PAID', label: 'debts.filters.PARTIALLY_PAID' },
  { value: 'PAID', label: 'debts.filters.PAID' },
  { value: 'overdue', label: 'debts.filters.overdue' },
];

export const DEBT_STATUS: Record<DebtStatus, { label: TextKey; tone: 'info' | 'warning' | 'success' }> = {
  ACTIVE: { label: 'debts.status.ACTIVE', tone: 'info' },
  PARTIALLY_PAID: { label: 'debts.status.PARTIALLY_PAID', tone: 'warning' },
  PAID: { label: 'debts.status.PAID', tone: 'success' },
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
  return debt.dueDate ? t('debts.due.on', { date: formatDate(debt.dueDate) }) : t('debts.due.none');
}

/** "Muddati o‘tgan!", or a warning for the last three days; nothing otherwise. */
export function dueChip(debt: DebtResponse): { label: string; tone: 'danger' | 'warning' } | null {
  if (debt.isOverdue) return { label: t('debts.due.overdue'), tone: 'danger' };
  if (debt.status === 'PAID' || debt.daysLeft === null || debt.daysLeft > 3) return null;
  return { label: debt.daysLeft === 0 ? t('debts.due.today') : tn('debts.due.daysLeft', debt.daysLeft), tone: 'warning' };
}
