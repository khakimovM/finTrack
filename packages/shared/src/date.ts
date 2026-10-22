/**
 * Date utility functions for FinTrack.
 * All operations are strictly executed in UTC to avoid time zone drift.
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a string is a valid ISO date in `YYYY-MM-DD` format
 * and corresponds to an actual calendar date (e.g., checking leap years, 30-day months).
 */
export function isValidIsoDate(str: string): boolean {
  if (!ISO_DATE_REGEX.test(str)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = str.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Parses an ISO date string `YYYY-MM-DD` into a UTC Date object at 00:00:00.000Z.
 */
export function parseIsoDate(str: string): Date {
  const [yearStr, monthStr, dayStr] = str.split('-');
  return new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
}

/**
 * Formats a Date object into an ISO date string `YYYY-MM-DD` using UTC components.
 */
export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adds an integer number of days to a Date in UTC.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Adds an integer number of months to a Date in UTC.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetMonth = result.getUTCMonth() + months;
  const originalDay = result.getUTCDate();

  result.setUTCMonth(targetMonth, 1);
  const maxDaysInTargetMonth = endOfMonth(result).getUTCDate();
  result.setUTCDate(Math.min(originalDay, maxDaysInTargetMonth));

  return result;
}


/**
 * Adds an integer number of years to a Date in UTC.
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

/**
 * Returns the Monday of the ISO week for the given date at 00:00:00.000Z.
 */
export function startOfIsoWeek(date: Date): Date {
  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const isoDay = day === 0 ? 7 : day;
  return addDays(date, -(isoDay - 1));
}

/**
 * Returns the first day of the month for the given date at 00:00:00.000Z.
 */
export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Returns the last day of the month for the given date at 00:00:00.000Z.
 */
export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/**
 * Returns the first day of the year for the given date at 00:00:00.000Z.
 */
export function startOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

/**
 * Generates an array of discrete bucket strings (`YYYY-MM-DD`) between `from` and `to` inclusive.
 * Used for zero-filling time-series charts on the backend.
 */
export function generateDateBuckets(
  from: string,
  to: string,
  groupBy: 'day' | 'week' | 'month' | 'year',
): string[] {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);

  if (fromDate.getTime() > toDate.getTime()) {
    return [];
  }

  const buckets: string[] = [];

  switch (groupBy) {
    case 'day': {
      let curr = fromDate;
      while (curr.getTime() <= toDate.getTime()) {
        buckets.push(formatIsoDate(curr));
        curr = addDays(curr, 1);
      }
      break;
    }
    case 'week': {
      let curr = startOfIsoWeek(fromDate);
      while (curr.getTime() <= toDate.getTime()) {
        buckets.push(formatIsoDate(curr));
        curr = addDays(curr, 7);
      }
      break;
    }
    case 'month': {
      let curr = startOfMonth(fromDate);
      while (curr.getTime() <= toDate.getTime()) {
        buckets.push(formatIsoDate(curr));
        curr = addMonths(curr, 1);
      }
      break;
    }
    case 'year': {
      let curr = startOfYear(fromDate);
      while (curr.getTime() <= toDate.getTime()) {
        buckets.push(formatIsoDate(curr));
        curr = addYears(curr, 1);
      }
      break;
    }
  }

  return buckets;
}

/**
 * Calculates the immediately preceding period of equal duration.
 * Duration is defined as (to - from + 1) days.
 * For example:
 *   from = '2026-08-01', to = '2026-08-31' (31 days)
 *   -> { from: '2026-07-01', to: '2026-07-31' } (31 days)
 */
export function calculatePreviousPeriod(
  from: string,
  to: string,
): { from: string; to: string } {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);

  const durationMs = toDate.getTime() - fromDate.getTime();
  const durationDays = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)) + 1);

  const prevTo = addDays(fromDate, -1);
  const prevFrom = addDays(prevTo, -(durationDays - 1));

  return {
    from: formatIsoDate(prevFrom),
    to: formatIsoDate(prevTo),
  };
}

/** Whole calendar months a range covers (1st of a month to the last day of one), else 0. */
function wholeMonths(from: Date, to: Date): number {
  if (from.getUTCDate() !== 1 || to.getTime() !== endOfMonth(to).getTime()) return 0;
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() + 1;
}

/**
 * What a period is compared with ("o‘tgan oyga nisbatan"). Whole months are set against the
 * months just before them (October against 1–30 September, not the 31 days before it, which
 * would take in 31 August); any other range against as many days right before it. While the
 * period is still running only its days so far are matched: a month on its 22nd day is set
 * against the 1st–22nd of the previous one, or every month would look cheaper until its end.
 */
export function comparablePreviousPeriod(
  from: string,
  to: string,
  today: string,
): { from: string; to: string } {
  const start = parseIsoDate(from);
  const months = wholeMonths(start, parseIsoDate(to));
  const running = from <= today && today < to;

  if (months > 0) {
    const prevTo = addDays(start, -1);
    // addMonths clamps 31 March to 28 February.
    const sameDay = addMonths(parseIsoDate(today), -months);
    const end = running && sameDay.getTime() < prevTo.getTime() ? sameDay : prevTo;
    return { from: formatIsoDate(addMonths(start, -months)), to: formatIsoDate(end) };
  }

  const previous = calculatePreviousPeriod(from, to);
  if (!running) return previous;
  return {
    from: previous.from,
    to: formatIsoDate(addDays(parseIsoDate(previous.from), diffInDays(from, today))),
  };
}

/**
 * Calendar date (`YYYY-MM-DD`) of `now` as seen in an IANA time zone.
 * Money is recorded against the user's local day, not the server's UTC day: at 02:00 in
 * Tashkent (UTC+5) the UTC date is still "yesterday".
 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Calendar date of `now` in the runtime's local time zone (use in the browser). */
export function todayLocalIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative when `to` is earlier. */
export function diffInDays(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}
