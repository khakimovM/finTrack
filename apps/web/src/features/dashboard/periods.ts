import type { StatsTimeseriesItem, TimeseriesGroupBy, TransactionResponse } from '@fintrack/shared';
import type { PeriodPreset } from '../../stores/periodStore';
import {
  capitalise,
  formatDayMonth,
  formatShortDate,
  monthShortStandaloneNames,
  monthStandaloneNames,
  weekdayIndex,
  weekdayNames,
  weekdayShortNames,
} from '../../lib/format';
import { tiyinToChartNumber } from '../../lib/money';
import type { TrendPoint } from '../../components/charts/AreaTrend';
import { t, type TextKey } from '../../lib/i18n';

const EN_DASH = String.fromCharCode(0x2013);

export const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: TextKey }> = [
  { value: 'today', label: 'dashboard.period.today' },
  { value: 'this_week', label: 'dashboard.period.this_week' },
  { value: 'this_month', label: 'dashboard.period.this_month' },
  { value: 'this_year', label: 'dashboard.period.this_year' },
  { value: 'custom', label: 'dashboard.period.custom' },
];

/** A period still running is compared with the same days of the one before (comparablePreviousPeriod). */
const VS_SO_FAR: Partial<Record<PeriodPreset, TextKey>> = {
  this_week: 'dashboard.vs.weekSoFar',
  this_month: 'dashboard.vs.monthSoFar',
  this_year: 'dashboard.vs.yearSoFar',
};

/** What the balance chip compares with: the balance just before the period began. */
const BALANCE_VS: Record<PeriodPreset, TextKey> = {
  today: 'dashboard.vs.balanceToday',
  this_week: 'dashboard.vs.balanceWeek',
  this_month: 'dashboard.vs.balanceMonth',
  this_year: 'dashboard.vs.balanceYear',
  custom: 'dashboard.vs.balanceCustom',
};

/** What the income and expense chips compare with (`summary.previousPeriod`), and the balance chip. */
export function comparisonTexts(range: { preset: PeriodPreset; from: string; to: string }, today: string) {
  const running = range.from <= today && today < range.to;
  return {
    flow: t((running && VS_SO_FAR[range.preset]) || `dashboard.vs.${range.preset}`),
    balance: t(BALANCE_VS[range.preset]),
  };
}

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
        label = capitalise(monthShortStandaloneNames()[m - 1]);
        title = `${capitalise(monthStandaloneNames()[m - 1])} ${item.bucket.slice(0, 4)}`;
      } else {
        const weekday = weekdayIndex(item.bucket);
        label = range.preset === 'this_week' ? weekdayShortNames()[weekday] : formatShortDate(item.bucket);
        title = `${formatDayMonth(item.bucket)}, ${weekdayNames()[weekday]}`;
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
  for (const tx of transactions) {
    if (tx.date !== today || (tx.type !== 'INCOME' && tx.type !== 'EXPENSE')) continue;
    const slot = Math.floor(new Date(tx.createdAt).getHours() / 2);
    const key = tx.type === 'INCOME' ? 'income' : 'expense';
    points[slot][key] = Number(points[slot][key]) + tiyinToChartNumber(tx.amount);
  }
  return points;
}

/** True when a chart has nothing to draw. */
export function isFlat(points: TrendPoint[], keys: string[]): boolean {
  return points.every((p) => keys.every((k) => Number(p[k] ?? 0) === 0));
}
