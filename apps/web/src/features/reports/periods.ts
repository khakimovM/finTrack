import {
  addMonths,
  comparablePreviousPeriod,
  endOfMonth,
  formatIsoDate,
  parseIsoDate,
  startOfMonth,
  startOfYear,
} from '@fintrack/shared';

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
 * A month or year in progress is shown up to today and compared with the same days of the
 * previous one (comparablePreviousPeriod, the rule the dashboard's chips follow too).
 */
export function comparisonFor(preset: ReportPreset, today: string, custom?: DateRange): Comparison {
  const t = parseIsoDate(today);
  const whole = (from: Date, to: Date): Comparison => {
    const { from: start, to: end } = range(from, to);
    return { current: { from: start, to: end < today ? end : today }, previous: comparablePreviousPeriod(start, end, today) };
  };
  switch (preset) {
    case 'this_month':
      return whole(startOfMonth(t), endOfMonth(t));
    case 'last_month': {
      const from = startOfMonth(addMonths(t, -1));
      return whole(from, endOfMonth(from));
    }
    case 'this_year': {
      const from = startOfYear(t);
      return whole(from, new Date(Date.UTC(from.getUTCFullYear(), 11, 31)));
    }
    case 'custom': {
      const current = custom ?? { from: today, to: today };
      return { current, previous: comparablePreviousPeriod(current.from, current.to, today) };
    }
  }
}
