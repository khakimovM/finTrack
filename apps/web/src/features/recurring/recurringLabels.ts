import { RecurrenceFrequency, RecurringRuleResponse } from '@fintrack/shared';
import { formatDate, weekdayIndex } from '../../lib/format';

/** ISO weekday order, matching the API's dayOfCycle 1 (Monday) … 7 (Sunday). */
export const WEEKDAYS = [
  'dushanba',
  'seshanba',
  'chorshanba',
  'payshanba',
  'juma',
  'shanba',
  'yakshanba',
];

export const FREQUENCY_OPTIONS: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: 'MONTHLY', label: 'Har oy' },
  { value: 'WEEKLY', label: 'Har hafta' },
  { value: 'DAILY', label: 'Har kuni' },
  { value: 'YEARLY', label: 'Har yili' },
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
      return 'Har kuni';
    case 'WEEKLY':
      return `Har hafta, ${WEEKDAYS[(dayOfCycle ?? isoWeekday(startsAt)) - 1]}`;
    case 'MONTHLY': {
      const day = dayOfCycle ?? Number(startsAt.slice(8, 10));
      // The API moves a missing day (31 February) to the month's last day.
      return day >= 29 ? `Har oy, ${day}-kuni (qisqa oylarda oxirgi kuni)` : `Har oy, ${day}-kuni`;
    }
    case 'YEARLY':
      return `Har yili, ${formatDate(startsAt).replace(/, \d{4}$/, '')}`;
  }
}

/** The category names the rule; without one the note does, then the type. */
export function ruleTitle(rule: Pick<RecurringRuleResponse, 'category' | 'note' | 'type'>): string {
  return rule.category?.name ?? (rule.note || (rule.type === 'INCOME' ? 'Kirim' : 'Chiqim'));
}
