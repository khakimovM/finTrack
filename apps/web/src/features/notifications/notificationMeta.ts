import { ChartPie, Clock, Repeat, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { NotificationResponse, NotificationType } from '@fintrack/shared';
import { formatDayMonth, formatShortDate, formatTime } from '../../lib/format';
import { t, type TextKey } from '../../lib/i18n';

type Tone = 'warning' | 'danger' | 'info';

interface TypeStyle {
  icon: LucideIcon;
  tone: Tone;
  linkLabel: TextKey;
}

export const NOTIFICATION_STYLE: Record<NotificationType, TypeStyle> = {
  BUDGET_WARNING: { icon: ChartPie, tone: 'warning', linkLabel: 'notifications.open.budget' },
  BUDGET_EXCEEDED: { icon: ChartPie, tone: 'danger', linkLabel: 'notifications.open.budget' },
  DEBT_DUE_SOON: { icon: Clock, tone: 'warning', linkLabel: 'notifications.open.debt' },
  DEBT_OVERDUE: { icon: Users, tone: 'danger', linkLabel: 'notifications.open.debt' },
  NEGATIVE_BALANCE: { icon: Wallet, tone: 'danger', linkLabel: 'notifications.open.account' },
  RECURRING_CREATED: { icon: Repeat, tone: 'info', linkLabel: 'notifications.open.rule' },
  RECURRING_SKIPPED: { icon: Repeat, tone: 'warning', linkLabel: 'notifications.open.rule' },
};

export const TONE_TILE: Record<Tone, string> = {
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

function metaString(meta: NotificationResponse['meta'], key: string): string | null {
  const value = meta?.[key];
  return typeof value === 'string' && value ? value : null;
}

/** Where a notification leads: the debt it is about, the account's entries, the budgets or rules. */
export function notificationLink(notification: Pick<NotificationResponse, 'type' | 'meta'>): string {
  switch (notification.type) {
    case 'DEBT_DUE_SOON':
    case 'DEBT_OVERDUE': {
      const debtId = metaString(notification.meta, 'debtId');
      return debtId ? `/app/debts?debt=${encodeURIComponent(debtId)}` : '/app/debts';
    }
    case 'NEGATIVE_BALANCE': {
      const accountId = metaString(notification.meta, 'accountId');
      return accountId ? `/app/transactions?accountId=${encodeURIComponent(accountId)}` : '/app/accounts';
    }
    case 'BUDGET_WARNING':
    case 'BUDGET_EXCEEDED':
      return '/app/budgets';
    case 'RECURRING_CREATED':
    case 'RECURRING_SKIPPED':
      return '/app/recurring';
  }
}

/** Local calendar day of a timestamp, "YYYY-MM-DD". */
export function localDay(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "14:05" for today, "27-sen, 14:05" otherwise. */
export function notificationTime(createdAt: string, today: string): string {
  const day = localDay(createdAt);
  return day === today ? formatTime(createdAt) : `${formatShortDate(day)}, ${formatTime(createdAt)}`;
}

/** Group heading: "Bugun", "Kecha", then "1-oktabr". */
export function notificationDayLabel(day: string, today: string, yesterday: string): string {
  if (day === today) return t('common.today');
  if (day === yesterday) return t('common.yesterday');
  return formatDayMonth(day);
}
