import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDayHeader,
  formatMonth,
  formatPercent,
  formatRange,
  formatRelativeDay,
  formatShortDate,
  weekdayIndex,
} from './format';
import { useLocaleStore } from '../stores/localeStore';

const DASH = String.fromCharCode(0x2013);

describe('date labels', () => {
  it('writes days the way the design does', () => {
    expect(formatDate('2026-10-03')).toBe('3-oktabr, 2026');
    expect(formatShortDate('2026-09-27')).toBe('27-sen');
    expect(formatMonth('2026-10')).toBe('Oktabr 2026');
  });

  it('starts weeks on Monday', () => {
    expect(weekdayIndex('2026-09-28')).toBe(0); // dushanba
    expect(weekdayIndex('2026-10-04')).toBe(6); // yakshanba
  });

  it('names today and yesterday, including across a month boundary', () => {
    expect(formatRelativeDay('2026-10-03', '2026-10-03')).toBe('Bugun');
    expect(formatRelativeDay('2026-09-30', '2026-10-01')).toBe('Kecha');
    expect(formatRelativeDay('2026-09-25', '2026-10-01')).toBe('25-sen');
  });

  it('builds day-group headers with the weekday', () => {
    expect(formatDayHeader('2026-10-03', '2026-10-03')).toBe('Bugun · 3-oktabr, shanba');
    expect(formatDayHeader('2026-10-02', '2026-10-03')).toBe('Kecha · 2-oktabr, juma');
    expect(formatDayHeader('2026-10-01', '2026-10-03')).toBe('1-oktabr, payshanba');
  });

  it('formats ranges inside a month, across months and across years', () => {
    expect(formatRange('2026-10-03', '2026-10-03')).toBe('3-oktabr, 2026');
    expect(formatRange('2026-10-01', '2026-10-31')).toBe(`1${DASH}31-oktabr, 2026`);
    expect(formatRange('2026-09-28', '2026-10-04')).toBe(`28-sentabr ${DASH} 4-oktabr, 2026`);
    expect(formatRange('2025-12-29', '2026-01-04')).toBe(`29-dekabr, 2025 ${DASH} 4-yanvar, 2026`);
  });

  it('formats percentages with a comma and drops ",0"', () => {
    expect(formatPercent(8.44)).toBe('8,4%');
    expect(formatPercent(12)).toBe('12%');
    expect(formatPercent(65.79)).toBe('65,8%');
  });
});

describe('date labels in Russian', () => {
  beforeEach(() => useLocaleStore.setState({ locale: 'ru' }));

  it('puts the day before the month in the genitive, with the year after a space', () => {
    expect(formatDate('2026-10-03')).toBe('3 октября 2026');
    expect(formatShortDate('2026-05-09')).toBe('9 мая');
    expect(formatMonth('2026-05')).toBe('Май 2026');
    expect(formatDateTime('2026-10-03T09:05:00')).toBe('3 октября, 09:05');
  });

  it('names today and yesterday and writes the weekday in headers', () => {
    expect(formatRelativeDay('2026-10-03', '2026-10-03')).toBe('Сегодня');
    expect(formatRelativeDay('2026-09-30', '2026-10-01')).toBe('Вчера');
    expect(formatDayHeader('2026-10-03', '2026-10-03')).toBe('Сегодня · 3 октября, суббота');
    expect(formatDayHeader('2026-10-01', '2026-10-03')).toBe('1 октября, четверг');
  });

  it('formats ranges inside a month, across months and across years', () => {
    expect(formatRange('2026-10-01', '2026-10-31')).toBe(`1${DASH}31 октября 2026`);
    expect(formatRange('2026-09-28', '2026-10-04')).toBe(`28 сентября ${DASH} 4 октября 2026`);
    expect(formatRange('2025-12-29', '2026-01-04')).toBe(`29 декабря 2025 ${DASH} 4 января 2026`);
  });

  it('stays Uzbek on the admin panel', () => {
    window.history.pushState({}, '', '/admin/users');
    try {
      expect(formatDate('2026-10-03')).toBe('3-oktabr, 2026');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });
});
