import { addDays, endOfMonth, formatIsoDate, parseIsoDate } from './date';
import type { RecurrenceFrequency } from './schemas/recurring';

/**
 * The schedule of recurring rules, shared so the API books payments on the same days the form's
 * "Keyingi to‘lov" preview promises. All dates are UTC midnights of calendar days.
 */

function daysInMonth(year: number, monthIndex: number): number {
  return endOfMonth(new Date(Date.UTC(year, monthIndex, 1))).getUTCDate();
}

/** The `day`-th of the month, clamped to the month's last day (31 → 28/29/30). */
function clampedDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))));
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Default anchor stored on the rule so the schedule never drifts: a monthly rule started on
 * the 31st stays on "the last day" instead of sliding to the 28th forever after February.
 */
export function defaultDayOfCycle(
  frequency: RecurrenceFrequency,
  startsAt: Date,
  dayOfCycle?: number | null,
): number | null {
  if (dayOfCycle != null) return dayOfCycle;
  if (frequency === 'MONTHLY') return startsAt.getUTCDate();
  if (frequency === 'WEEKLY') return isoWeekday(startsAt);
  return null;
}

/** First date on or after `from` that matches the rule's anchor. */
export function firstOccurrenceOnOrAfter(
  from: Date,
  frequency: RecurrenceFrequency,
  startsAt: Date,
  dayOfCycle: number | null,
): Date {
  switch (frequency) {
    case 'DAILY':
      return from;
    case 'WEEKLY': {
      const target = dayOfCycle ?? isoWeekday(startsAt);
      return addDays(from, (target - isoWeekday(from) + 7) % 7);
    }
    case 'MONTHLY': {
      const day = dayOfCycle ?? startsAt.getUTCDate();
      const candidate = clampedDay(from.getUTCFullYear(), from.getUTCMonth(), day);
      return candidate >= from ? candidate : clampedDay(from.getUTCFullYear(), from.getUTCMonth() + 1, day);
    }
    case 'YEARLY': {
      const candidate = clampedDay(from.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate());
      return candidate >= from
        ? candidate
        : clampedDay(from.getUTCFullYear() + 1, startsAt.getUTCMonth(), startsAt.getUTCDate());
    }
  }
}

/** The occurrence after `current`. */
export function nextOccurrence(
  current: Date,
  frequency: RecurrenceFrequency,
  startsAt: Date,
  dayOfCycle: number | null,
): Date {
  switch (frequency) {
    case 'DAILY':
      return addDays(current, 1);
    case 'WEEKLY':
      return addDays(current, 7);
    case 'MONTHLY':
      return clampedDay(
        current.getUTCFullYear(),
        current.getUTCMonth() + 1,
        dayOfCycle ?? startsAt.getUTCDate(),
      );
    case 'YEARLY':
      return clampedDay(current.getUTCFullYear() + 1, startsAt.getUTCMonth(), startsAt.getUTCDate());
  }
}

/**
 * The first payment date of a rule as the API will schedule it, or null when it would fall after
 * `endsAt`. Dates are YYYY-MM-DD; nothing is booked for days before `today`.
 */
export function firstRunDate(
  rule: { frequency: RecurrenceFrequency; startsAt: string; dayOfCycle?: number | null; endsAt?: string | null },
  today: string,
): string | null {
  const startsAt = parseIsoDate(rule.startsAt);
  const from = rule.startsAt > today ? startsAt : parseIsoDate(today);
  const day = defaultDayOfCycle(rule.frequency, startsAt, rule.dayOfCycle);
  const first = formatIsoDate(firstOccurrenceOnOrAfter(from, rule.frequency, startsAt, day));
  return rule.endsAt && first > rule.endsAt ? null : first;
}
