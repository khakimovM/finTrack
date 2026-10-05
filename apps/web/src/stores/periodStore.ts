import { create } from 'zustand';
import {
  diffInDays,
  formatIsoDate,
  parseIsoDate,
  todayLocalIso,
  startOfIsoWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  addDays,
  TimeseriesGroupBy,
} from '@fintrack/shared';

export type PeriodPreset = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';

export interface PeriodState {
  preset: PeriodPreset;
  from: string;
  to: string;
  groupBy: TimeseriesGroupBy;
  setPreset: (preset: Exclude<PeriodPreset, 'custom'>) => void;
  setCustomRange: (from: string, to: string) => void;
}

/** Bucket size for a custom range: days up to a month, weeks up to ~4 months, then months. */
export function groupByForRange(from: string, to: string): TimeseriesGroupBy {
  const days = Math.max(1, diffInDays(from, to));
  return days > 120 ? 'month' : days > 31 ? 'week' : 'day';
}

/**
 * Whole calendar periods, as the dashboard shows them: Monday–Sunday, the 1st to the last day,
 * January–December. "Today" is the user's calendar day, not the UTC day.
 */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, today = todayLocalIso()) {
  const now = parseIsoDate(today);
  switch (preset) {
    case 'today':
      return { from: today, to: today, groupBy: 'day' as const };
    case 'this_week': {
      const start = startOfIsoWeek(now);
      return { from: formatIsoDate(start), to: formatIsoDate(addDays(start, 6)), groupBy: 'day' as const };
    }
    case 'this_month':
      return { from: formatIsoDate(startOfMonth(now)), to: formatIsoDate(endOfMonth(now)), groupBy: 'week' as const };
    case 'this_year': {
      const start = startOfYear(now);
      return { from: formatIsoDate(start), to: `${start.getUTCFullYear()}-12-31`, groupBy: 'month' as const };
    }
  }
}

const initial = presetRange('this_month');

export const usePeriodStore = create<PeriodState>((set) => ({
  preset: 'this_month',
  ...initial,
  setPreset: (preset) => set({ preset, ...presetRange(preset) }),
  setCustomRange: (from, to) => set({ preset: 'custom', from, to, groupBy: groupByForRange(from, to) }),
}));
