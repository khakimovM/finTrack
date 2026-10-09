import { AdminChannel, AdminStatsGroupBy, addDays, formatIsoDate, parseIsoDate } from '@fintrack/shared';
import { NBSP } from '../../lib/money';
import { MONTHS_SHORT, formatDate, formatMonth, formatRange, formatShortDate } from '../../lib/format';

/** 12 345 with a no-break space, like the amounts. */
export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Whole percent of `whole` (0 when there is nothing to divide by). */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Change against the previous window for `ChangeChip`; null ("yangi") when it was 0. */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export const CHANNEL_LABELS: Record<AdminChannel, string> = {
  WEB: 'Sayt',
  MINIAPP: 'Mini App',
  BOT: 'Bot',
  UNKNOWN: 'Noma’lum',
};

/** Axis label of a bucket: "15-avg" for days and weeks, "okt" for months. */
export function bucketLabel(bucket: string, groupBy: AdminStatsGroupBy): string {
  if (groupBy === 'month') return MONTHS_SHORT[Number(bucket.slice(5, 7)) - 1];
  return formatShortDate(bucket);
}

/** Tooltip heading of a bucket: the day, the week's dates or the month. */
export function bucketTitle(bucket: string, groupBy: AdminStatsGroupBy): string {
  if (groupBy === 'day') return formatDate(bucket);
  if (groupBy === 'week') return `${formatRange(bucket, formatIsoDate(addDays(parseIsoDate(bucket), 6)))} haftasi`;
  return formatMonth(bucket.slice(0, 7));
}

/** "1,2 GB", "340 MB", "12 KB". */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')}${NBSP}${units[unit]}`;
}

/** "3 kun 4 soat", "2 soat 15 daqiqa", "40 daqiqa". */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days} kun ${hours} soat`;
  if (hours > 0) return `${hours} soat ${minutes} daqiqa`;
  return `${minutes} daqiqa`;
}
