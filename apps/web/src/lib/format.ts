/**
 * Date labels exactly as the design writes them: "3-oktabr, 2026", "3-okt", "Bugun · 3-oktabr,
 * shanba", "1–31-oktabr, 2026"; in Russian "3 октября 2026", "3 окт", "Сегодня · 3 октября,
 * суббота", "1–31 октября 2026". Own name tables (shared with the bot) instead of date-fns'
 * locales, which capitalise months and abbreviate weekdays differently ("Cho", "Sha").
 */
import {
  MONTHS_IN_DATE,
  MONTHS_SHORT,
  MONTHS_SHORT_STANDALONE,
  MONTHS_STANDALONE,
  WEEKDAYS,
  WEEKDAYS_SHORT,
} from '@fintrack/shared';
import { currentLocale, t } from './i18n';

/** Month names as a date writes them: "oktabr", "октября". */
export const monthNames = () => MONTHS_IN_DATE[currentLocale()];
/** Month names as a label on their own: "oktabr", "октябрь" (capitalise for a heading). */
export const monthStandaloneNames = () => MONTHS_STANDALONE[currentLocale()];
export const monthShortNames = () => MONTHS_SHORT[currentLocale()];
/** Short months on a chart axis: "may", "май". */
export const monthShortStandaloneNames = () => MONTHS_SHORT_STANDALONE[currentLocale()];
/** Monday first, as the calendars in the design. */
export const weekdayNames = () => WEEKDAYS[currentLocale()];
export const weekdayShortNames = () => WEEKDAYS_SHORT[currentLocale()];

const EN_DASH = String.fromCharCode(0x2013);

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

function parts(iso: string): Ymd {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "15-avgust", "15 августа": Uzbek joins the day to the month, Russian puts a space. */
function dayAndMonth(d: number | string, monthName: string): string {
  return currentLocale() === 'ru' ? `${d} ${monthName}` : `${d}-${monthName}`;
}

/** A day or a span of days in a month (1-12): "1–7-oktabr", "1–7 октября". */
export function daysOfMonth(days: number | string, m: number): string {
  return dayAndMonth(days, monthNames()[m - 1]);
}

function withYear(label: string, y: number): string {
  return currentLocale() === 'ru' ? `${label} ${y}` : `${label}, ${y}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  const { y, m, d } = parts(iso);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** "15-avgust, 2026". */
export function formatDate(iso: string): string {
  const { y } = parts(iso);
  return withYear(formatDayMonth(iso), y);
}

/** "15-avg" for tight spaces. */
export function formatShortDate(iso: string): string {
  const { m, d } = parts(iso);
  return dayAndMonth(d, monthShortNames()[m - 1]);
}

/** "15-avgust" without the year, for ranges and chart tooltips. */
export function formatDayMonth(iso: string): string {
  const { m, d } = parts(iso);
  return dayAndMonth(d, monthNames()[m - 1]);
}

/** "Sentabr 2026" for a "YYYY-MM" month (a standalone label, so capitalised). */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${capitalise(monthStandaloneNames()[m - 1])} ${y}`;
}

function shiftIso(iso: string, days: number): string {
  const { y, m, d } = parts(iso);
  const date = new Date(y, m - 1, d + days);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0')))
    .join('-');
}

/** "Bugun", "Kecha", otherwise "3-okt". */
export function formatRelativeDay(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  if (day === today) return t('common.today');
  if (day === shiftIso(today, -1)) return t('common.yesterday');
  return formatShortDate(day);
}

/** Group header for day-grouped lists: "Bugun · 3-oktabr, shanba", "1-oktabr, payshanba". */
export function formatDayHeader(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  const label = `${formatDayMonth(day)}, ${weekdayNames()[weekdayIndex(day)]}`;
  if (day === today) return `${t('common.today')} · ${label}`;
  if (day === shiftIso(today, -1)) return `${t('common.yesterday')} · ${label}`;
  return label;
}

/**
 * "3-oktabr, 2026" for one day, "1–31-oktabr, 2026" inside a month,
 * "28-sentabr – 4-oktabr, 2026" across months, years spelled out when they differ.
 */
export function formatRange(from: string, to: string): string {
  const a = parts(from);
  const b = parts(to);
  if (from.slice(0, 10) === to.slice(0, 10)) return formatDate(from);
  if (a.y === b.y && a.m === b.m) return withYear(`${a.d}${EN_DASH}${formatDayMonth(to)}`, b.y);
  if (a.y === b.y) return withYear(`${formatDayMonth(from)} ${EN_DASH} ${formatDayMonth(to)}`, b.y);
  return `${formatDate(from)} ${EN_DASH} ${formatDate(to)}`;
}

/** "14:05" in the viewer's local time. */
export function formatTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "3-oktabr, 14:05" for timestamps such as session activity. */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return `${dayAndMonth(date.getDate(), monthNames()[date.getMonth()])}, ${formatTime(isoDateTime)}`;
}

/** "8,4%" — one decimal with a comma, a trailing ",0" dropped. */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')}%`;
}
