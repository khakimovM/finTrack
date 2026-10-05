import type { StatsTimeseriesItem, TimeseriesGroupBy, TransactionResponse } from '@fintrack/shared';
import type { PeriodPreset } from '../../stores/periodStore';
import { formatDayMonth, formatShortDate, MONTHS, MONTHS_SHORT, WEEKDAYS, WEEKDAYS_SHORT, weekdayIndex } from '../../lib/format';
import { tiyinToChartNumber } from '../../lib/money';
import type { TrendPoint } from '../../components/charts/AreaTrend';

const EN_DASH = String.fromCharCode(0x2013);

export const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: 'Bugun' },
  { value: 'this_week', label: 'Shu hafta' },
  { value: 'this_month', label: 'Shu oy' },
  { value: 'this_year', label: 'Shu yil' },
  { value: 'custom', label: 'Oraliq' },
];

/** What the KPI change chips compare with. */
export const VS_TEXT: Record<PeriodPreset, string> = {
  today: 'kechaga nisbatan',
  this_week: 'o‘tgan haftaga nisbatan',
  this_month: 'o‘tgan oyga nisbatan',
  this_year: 'o‘tgan yilga nisbatan',
  custom: 'oldingi davrga nisbatan',
};

/**
 * Percent change for a chip: null when the previous value was 0 and there is something now
 * ("yangi"), 0 when both are 0 ("o‘zgarmadi").
 */
export function changePercent(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return current === 0n ? 0 : null;
  const diff = current - previous;
  const abs = previous < 0n ? -previous : previous;
  // Basis points keep two decimals of precision without floats on money.
  return Number((diff * 10_000n) / abs) / 100;
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

const day = (iso: string) => Number(iso.slice(8, 10));
const month = (iso: string) => Number(iso.slice(5, 7));

/** "1–5" and "1–5-oktabr" for a week clipped to the period; months spelled out across months. */
function weekLabels(bucket: string, from: string, to: string): { label: string; title: string } {
  const start = bucket < from ? from : bucket;
  const endOfWeek = shift(bucket, 6);
  const end = endOfWeek > to ? to : endOfWeek;
  if (start === end) return { label: String(day(start)), title: formatDayMonth(start) };
  if (month(start) === month(end)) {
    return { label: `${day(start)}${EN_DASH}${day(end)}`, title: `${day(start)}${EN_DASH}${formatDayMonth(end)}` };
  }
  return {
    label: `${formatShortDate(start)}${EN_DASH}${formatShortDate(end)}`,
    title: `${formatDayMonth(start)} ${EN_DASH} ${formatDayMonth(end)}`,
  };
}

/**
 * API buckets → chart points. Days read as weekdays in a week view and as dates otherwise; weeks
 * as day ranges; months as "Yan". Months after the current one are dropped (the year is drawn to
 * date).
 */
export function flowPoints(
  items: StatsTimeseriesItem[],
  groupBy: TimeseriesGroupBy,
  range: { from: string; to: string; preset: PeriodPreset },
  today: string,
): TrendPoint[] {
  return items
    .filter((item) => !(groupBy === 'month' && item.bucket.slice(0, 7) > today.slice(0, 7)))
    .map((item) => {
      let label: string;
      let title: string;
      if (groupBy === 'week') {
        ({ label, title } = weekLabels(item.bucket, range.from, range.to));
      } else if (groupBy === 'month' || groupBy === 'year') {
        const m = month(item.bucket);
        label = MONTHS_SHORT[m - 1].charAt(0).toUpperCase() + MONTHS_SHORT[m - 1].slice(1);
        title = `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} ${item.bucket.slice(0, 4)}`;
      } else {
        const weekday = weekdayIndex(item.bucket);
        label = range.preset === 'this_week' ? WEEKDAYS_SHORT[weekday] : formatShortDate(item.bucket);
        title = `${formatDayMonth(item.bucket)}, ${WEEKDAYS[weekday]}`;
      }
      return { label, title, income: tiyinToChartNumber(item.income), expense: tiyinToChartNumber(item.expense) };
    });
}

/** Today in two-hour steps from the entries' recording time ("08", title "08:00–10:00"). */
export function hourlyPoints(transactions: TransactionResponse[], today: string): TrendPoint[] {
  const points: TrendPoint[] = Array.from({ length: 12 }, (_, i) => {
    const h = String(i * 2).padStart(2, '0');
    const next = String(i * 2 + 2).padStart(2, '0');
    return { label: h, title: `${h}:00${EN_DASH}${next}:00`, income: 0, expense: 0 };
  });
  for (const t of transactions) {
    if (t.date !== today || (t.type !== 'INCOME' && t.type !== 'EXPENSE')) continue;
    const slot = Math.floor(new Date(t.createdAt).getHours() / 2);
    const key = t.type === 'INCOME' ? 'income' : 'expense';
    points[slot][key] = Number(points[slot][key]) + tiyinToChartNumber(t.amount);
  }
  return points;
}

/** True when a chart has nothing to draw. */
export function isFlat(points: TrendPoint[], keys: string[]): boolean {
  return points.every((p) => keys.every((k) => Number(p[k] ?? 0) === 0));
}
