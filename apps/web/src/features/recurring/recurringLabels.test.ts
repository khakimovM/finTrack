import { describe, expect, it } from 'vitest';
import { hasDayOfCycle, scheduleLabel } from './recurringLabels';
import { formatDate, formatMonth, formatShortDate } from '../../lib/format';

describe('scheduleLabel', () => {
  it.each([
    [{ frequency: 'DAILY', dayOfCycle: null, startsAt: '2026-09-01' }, 'Har kuni'],
    [{ frequency: 'WEEKLY', dayOfCycle: 5, startsAt: '2026-09-01' }, 'Har hafta, juma'],
    // 2026-09-06 is a Sunday: without a chosen day the start date decides.
    [{ frequency: 'WEEKLY', dayOfCycle: null, startsAt: '2026-09-06' }, 'Har hafta, yakshanba'],
    [{ frequency: 'MONTHLY', dayOfCycle: 5, startsAt: '2026-09-01' }, 'Har oy, 5-kuni'],
    [{ frequency: 'MONTHLY', dayOfCycle: null, startsAt: '2026-09-14' }, 'Har oy, 14-kuni'],
    [
      { frequency: 'MONTHLY', dayOfCycle: 31, startsAt: '2026-09-01' },
      'Har oy, 31-kuni (qisqa oylarda oxirgi kuni)',
    ],
    [{ frequency: 'YEARLY', dayOfCycle: null, startsAt: '2026-08-15' }, 'Har yili, 15-avgust'],
  ] as const)('%o → %s', (rule, label) => {
    expect(scheduleLabel(rule)).toBe(label);
  });

  it('asks for a day only for weekly and monthly rules', () => {
    expect([
      hasDayOfCycle('WEEKLY'),
      hasDayOfCycle('MONTHLY'),
      hasDayOfCycle('DAILY'),
      hasDayOfCycle('YEARLY'),
    ]).toEqual([true, true, false, false]);
  });
});

describe('date formatting', () => {
  it('writes month names in lower case inside dates, as Uzbek does', () => {
    expect(formatDate('2026-08-15')).toBe('15-avgust, 2026');
    expect(formatDate('2026-09-28T10:15:00.000Z')).toMatch(/^2[89]-sentabr, 2026$/);
    expect(formatShortDate('2026-01-03')).toBe('3-yan');
  });

  it('capitalises a standalone month label', () => {
    expect(formatMonth('2026-09')).toBe('Sentabr 2026');
  });
});
