import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDayHeader,
  formatMonth,
  formatPercent,
  formatRange,
  formatRelativeDay,
  formatShortDate,
  weekdayIndex,
} from './format';

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
