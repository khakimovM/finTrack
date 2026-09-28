import { format, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';

/**
 * Dates as docs/05 shows them: "15-avgust, 2026". date-fns capitalises Uzbek month names,
 * while Uzbek writes them in lower case inside a sentence.
 */
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'd-MMMM, yyyy', { locale: uz }).toLowerCase();
}

/** "15-avg" for tight spaces such as table rows and chart axes. */
export function formatShortDate(isoDate: string): string {
  return format(parseISO(isoDate), 'd-MMM', { locale: uz }).toLowerCase();
}

/** "Sentabr 2026" for a "YYYY-MM" month (a standalone label, so capitalised). */
export function formatMonth(month: string): string {
  return format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: uz });
}
