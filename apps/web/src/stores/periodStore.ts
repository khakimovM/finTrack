import { create } from 'zustand';
import {
  formatIsoDate,
  startOfIsoWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  TimeseriesGroupBy,
} from '@fintrack/shared';

export type PeriodPreset = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';

export interface PeriodState {
  preset: PeriodPreset;
  from: string;
  to: string;
  groupBy: TimeseriesGroupBy;
  setPreset: (preset: PeriodPreset) => void;
  setCustomRange: (from: string, to: string) => void;
  setGroupBy: (groupBy: TimeseriesGroupBy) => void;
}

const computePresetDates = (preset: PeriodPreset): { from: string; to: string; groupBy: TimeseriesGroupBy } => {
  const now = new Date();

  switch (preset) {
    case 'today': {
      const todayStr = formatIsoDate(now);
      return {
        from: todayStr,
        to: todayStr,
        groupBy: 'day',
      };
    }
    case 'this_week': {
      const startWeek = startOfIsoWeek(now);
      return {
        from: formatIsoDate(startWeek),
        to: formatIsoDate(now),
        groupBy: 'day',
      };
    }
    case 'this_month': {
      const startMonth = startOfMonth(now);
      const endMonth = endOfMonth(now);
      return {
        from: formatIsoDate(startMonth),
        to: formatIsoDate(endMonth),
        groupBy: 'day',
      };
    }
    case 'this_year': {
      const startYear = startOfYear(now);
      return {
        from: formatIsoDate(startYear),
        to: formatIsoDate(now),
        groupBy: 'month', // Requirement: Yillik davrda groupBy avtomatik month
      };
    }
    case 'custom':
    default: {
      const startMonth = startOfMonth(now);
      const endMonth = endOfMonth(now);
      return {
        from: formatIsoDate(startMonth),
        to: formatIsoDate(endMonth),
        groupBy: 'day',
      };
    }
  }
};

const initialDates = computePresetDates('this_month');

export const usePeriodStore = create<PeriodState>((set) => ({
  preset: 'this_month',
  from: initialDates.from,
  to: initialDates.to,
  groupBy: initialDates.groupBy,

  setPreset: (preset: PeriodPreset) => {
    if (preset === 'custom') {
      set({ preset: 'custom' });
      return;
    }
    const computed = computePresetDates(preset);
    set({
      preset,
      from: computed.from,
      to: computed.to,
      groupBy: computed.groupBy,
    });
  },

  setCustomRange: (from: string, to: string) => {
    // Agar oraliq 180 kundan ko'p bo'lsa groupBy 'month' qilamiz
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    const diffDays = Math.max(1, Math.round((toTime - fromTime) / (24 * 60 * 60 * 1000)));
    const groupBy: TimeseriesGroupBy = diffDays > 120 ? 'month' : diffDays > 31 ? 'week' : 'day';

    set({
      preset: 'custom',
      from,
      to,
      groupBy,
    });
  },

  setGroupBy: (groupBy: TimeseriesGroupBy) => set({ groupBy }),
}));
