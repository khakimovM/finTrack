import {
  addMonths,
  calculatePreviousPeriod,
  endOfMonth,
  formatIsoDate,
  parseIsoDate,
  startOfMonth,
  startOfYear,
} from '@fintrack/shared';
import { formatDate } from '../../lib/format';

export type ReportPreset = 'this_month' | 'last_month' | 'this_year' | 'custom';

export interface DateRange {
  from: string;
  to: string;
}

export interface Comparison {
  current: DateRange;
  previous: DateRange;
}

export const REPORT_PRESETS: Array<{ value: ReportPreset; label: string }> = [
  { value: 'this_month', label: 'Shu oy' },
  { value: 'last_month', label: 'O‘tgan oy' },
  { value: 'this_year', label: 'Shu yil' },
  { value: 'custom', label: 'Oraliq' },
];

const range = (from: Date, to: Date): DateRange => ({
  from: formatIsoDate(from),
  to: formatIsoDate(to),
});

/**
 * The previous period is the same stretch of time before. A month (or year) in progress is
 * compared with the same days of the previous one: against the whole previous month every
 * month would look cheaper until its last day. addMonths clamps 31 March to 28 February.
 */
export function comparisonFor(preset: ReportPreset, today: string, custom?: DateRange): Comparison {
  const t = parseIsoDate(today);
  switch (preset) {
    case 'this_month': {
      const from = startOfMonth(t);
      return { current: range(from, t), previous: range(addMonths(from, -1), addMonths(t, -1)) };
    }
    case 'last_month': {
      const from = startOfMonth(addMonths(t, -1));
      const before = addMonths(from, -1);
      return {
        current: range(from, endOfMonth(from)),
        previous: range(before, endOfMonth(before)),
      };
    }
    case 'this_year': {
      const from = startOfYear(t);
      return { current: range(from, t), previous: range(addMonths(from, -12), addMonths(t, -12)) };
    }
    case 'custom': {
      const current = custom ?? { from: today, to: today };
      return { current, previous: calculatePreviousPeriod(current.from, current.to) };
    }
  }
}

/** "1-sentabr, 2026 – 28-sentabr, 2026", or a single date when the range is one day. */
export function formatRange({ from, to }: DateRange): string {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}
