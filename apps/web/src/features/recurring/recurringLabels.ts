import { RecurrenceFrequency, RecurringRuleResponse } from '@fintrack/shared';
import { formatDayMonth, weekdayIndex, weekdayNames } from '../../lib/format';
import { t, type TextKey } from '../../lib/i18n';

export const FREQUENCY_OPTIONS: Array<{ value: RecurrenceFrequency; label: TextKey }> = [
  { value: 'MONTHLY', label: 'recurring.frequency.MONTHLY' },
  { value: 'WEEKLY', label: 'recurring.frequency.WEEKLY' },
  { value: 'DAILY', label: 'recurring.frequency.DAILY' },
  { value: 'YEARLY', label: 'recurring.frequency.YEARLY' },
];

/** Whether the rule lets the user pick the day (weekday or day of month). */
export function hasDayOfCycle(frequency: RecurrenceFrequency): boolean {
  return frequency === 'WEEKLY' || frequency === 'MONTHLY';
}

/** 1 = Monday … 7 = Sunday, like the API's dayOfCycle. */
function isoWeekday(isoDate: string): number {
  return weekdayIndex(isoDate) + 1;
}

type Schedule = Pick<RecurringRuleResponse, 'frequency' | 'dayOfCycle' | 'startsAt'>;

/** "Har oy, 5-kuni", "Har hafta, juma", "Har yili, 15-avgust". Without a day the start date decides. */
export function scheduleLabel({ frequency, dayOfCycle, startsAt }: Schedule): string {
  switch (frequency) {
    case 'DAILY':
      return t('recurring.frequency.DAILY');
    case 'WEEKLY':
      return t('recurring.schedule.weekly', { day: weekdayNames()[(dayOfCycle ?? isoWeekday(startsAt)) - 1] });
    case 'MONTHLY': {
      const day = dayOfCycle ?? Number(startsAt.slice(8, 10));
      // The API moves a missing day (31 February) to the month's last day.
      return t(day >= 29 ? 'recurring.schedule.monthlyLate' : 'recurring.schedule.monthly', { day });
    }
    case 'YEARLY':
      return t('recurring.schedule.yearly', { date: formatDayMonth(startsAt) });
  }
}

/** The category names the rule; without one the note does, then the type. */
export function ruleTitle(rule: Pick<RecurringRuleResponse, 'category' | 'note' | 'type'>): string {
  return rule.category?.name ?? (rule.note || (rule.type === 'INCOME' ? t('common.income') : t('common.expense')));
}
