import { defaultDayOfCycle, firstOccurrenceOnOrAfter, firstRunDate, formatIsoDate, nextOccurrence, parseIsoDate } from '@fintrack/shared';

const d = parseIsoDate;
const iso = formatIsoDate;

describe('recurrence', () => {
  describe('monthly', () => {
    it('keeps the 31st anchored through short months (no drift)', () => {
      const start = d('2026-01-31');
      const day = defaultDayOfCycle('MONTHLY', start);
      const dates: string[] = [];
      let cur = firstOccurrenceOnOrAfter(start, 'MONTHLY', start, day);
      for (let i = 0; i < 4; i++) {
        dates.push(iso(cur));
        cur = nextOccurrence(cur, 'MONTHLY', start, day);
      }
      expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    });

    it('uses leap-year February', () => {
      expect(iso(nextOccurrence(d('2028-01-31'), 'MONTHLY', d('2028-01-31'), 31))).toBe('2028-02-29');
    });

    it('first occurrence rolls into next month when the day has passed', () => {
      expect(iso(firstOccurrenceOnOrAfter(d('2026-09-20'), 'MONTHLY', d('2026-09-20'), 5))).toBe('2026-10-05');
      expect(iso(firstOccurrenceOnOrAfter(d('2026-09-02'), 'MONTHLY', d('2026-09-02'), 5))).toBe('2026-09-05');
    });
  });

  describe('weekly', () => {
    it('aligns to the ISO weekday (1 = Monday)', () => {
      // 2026-09-27 is a Sunday.
      expect(iso(firstOccurrenceOnOrAfter(d('2026-09-27'), 'WEEKLY', d('2026-09-27'), 1))).toBe('2026-09-28');
      expect(iso(firstOccurrenceOnOrAfter(d('2026-09-27'), 'WEEKLY', d('2026-09-27'), 7))).toBe('2026-09-27');
      expect(iso(nextOccurrence(d('2026-09-28'), 'WEEKLY', d('2026-09-27'), 1))).toBe('2026-10-05');
    });

    it('defaults the weekday to the start date', () => {
      expect(defaultDayOfCycle('WEEKLY', d('2026-09-27'))).toBe(7);
    });
  });

  describe('yearly', () => {
    it('keeps a Feb 29 anchor, clamping to Feb 28 in common years', () => {
      const start = d('2028-02-29');
      const next = nextOccurrence(start, 'YEARLY', start, null);
      expect(iso(next)).toBe('2029-02-28');
      expect(iso(nextOccurrence(d('2031-02-28'), 'YEARLY', start, null))).toBe('2032-02-29');
    });
  });

  it('daily steps one day and never needs an anchor', () => {
    expect(defaultDayOfCycle('DAILY', d('2026-09-27'))).toBeNull();
    expect(iso(nextOccurrence(d('2026-12-31'), 'DAILY', d('2026-01-01'), null))).toBe('2027-01-01');
  });
});

describe('firstRunDate (the form preview uses the same rule)', () => {
  it('starts from today when the rule started in the past', () => {
    expect(firstRunDate({ frequency: 'MONTHLY', startsAt: '2026-09-05', dayOfCycle: 5 }, '2026-10-03')).toBe('2026-10-05');
  });

  it('books today when today is the day', () => {
    expect(firstRunDate({ frequency: 'WEEKLY', startsAt: '2026-10-03', dayOfCycle: 6 }, '2026-10-03')).toBe('2026-10-03');
  });

  it('waits for a start in the future', () => {
    expect(firstRunDate({ frequency: 'YEARLY', startsAt: '2027-02-28' }, '2026-10-03')).toBe('2027-02-28');
  });

  it('gives nothing after the end date', () => {
    expect(firstRunDate({ frequency: 'MONTHLY', startsAt: '2026-10-03', dayOfCycle: 20, endsAt: '2026-10-10' }, '2026-10-03')).toBeNull();
  });
});
