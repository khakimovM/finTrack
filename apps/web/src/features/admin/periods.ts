import { addDays, formatIsoDate, parseIsoDate, todayInTimeZone } from '@fintrack/shared';
import type { AdminPeriod } from './api/admin.api';

/** The statistics count Tashkent days, so "today" in the panel is Tashkent's too. */
export const ADMIN_TIME_ZONE = 'Asia/Tashkent';

export type AdminRange = '7d' | '30d' | '90d' | '365d';

export const RANGE_LABELS: Record<AdminRange, string> = {
  '7d': '7 kun',
  '30d': '30 kun',
  '90d': '90 kun',
  '365d': '1 yil',
};

const RANGE_DAYS: Record<AdminRange, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

export function adminToday(now: Date = new Date()): string {
  return todayInTimeZone(ADMIN_TIME_ZONE, now);
}

/** The last N days, today included. */
export function rangeOf(range: AdminRange, today: string = adminToday()): AdminPeriod {
  return { from: formatIsoDate(addDays(parseIsoDate(today), -(RANGE_DAYS[range] - 1))), to: today };
}
