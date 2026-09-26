import {
  isValidIsoDate,
  parseIsoDate,
  formatIsoDate,
  addDays,
  addMonths,
  startOfIsoWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  generateDateBuckets,
  calculatePreviousPeriod,
  todayInTimeZone,
  diffInDays,
} from '@fintrack/shared';

describe('Date Utilities & Off-by-One Boundary Tests', () => {
  describe('isValidIsoDate', () => {
    it('accepts valid calendar dates', () => {
      expect(isValidIsoDate('2026-08-01')).toBe(true);
      expect(isValidIsoDate('2026-08-31')).toBe(true);
      expect(isValidIsoDate('2024-02-29')).toBe(true); // Leap year 2024
      expect(isValidIsoDate('2025-12-31')).toBe(true);
    });

    it('rejects invalid format or nonexistent dates', () => {
      expect(isValidIsoDate('2026/08/01')).toBe(false);
      expect(isValidIsoDate('2026-8-1')).toBe(false);
      expect(isValidIsoDate('2023-02-29')).toBe(false); // Not a leap year
      expect(isValidIsoDate('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidIsoDate('2026-13-01')).toBe(false);
      expect(isValidIsoDate('abc')).toBe(false);
    });
  });

  describe('Calendar Boundaries (Off-by-One)', () => {
    it('accurately parses and formats first and last days of month', () => {
      const firstDay = parseIsoDate('2026-08-01');
      const lastDay = parseIsoDate('2026-08-31');

      expect(formatIsoDate(firstDay)).toBe('2026-08-01');
      expect(formatIsoDate(lastDay)).toBe('2026-08-31');
      expect(formatIsoDate(startOfMonth(lastDay))).toBe('2026-08-01');
      expect(formatIsoDate(endOfMonth(firstDay))).toBe('2026-08-31');
    });

    it('correctly calculates leap year February endOfMonth', () => {
      const feb2024 = parseIsoDate('2024-02-10');
      expect(formatIsoDate(endOfMonth(feb2024))).toBe('2024-02-29');

      const feb2025 = parseIsoDate('2025-02-10');
      expect(formatIsoDate(endOfMonth(feb2025))).toBe('2025-02-28');
    });

    it('handles year boundary transitions smoothly', () => {
      const dec31 = parseIsoDate('2025-12-31');
      const nextDay = addDays(dec31, 1);
      expect(formatIsoDate(nextDay)).toBe('2026-01-01');
      expect(formatIsoDate(startOfYear(nextDay))).toBe('2026-01-01');
      expect(formatIsoDate(addMonths(dec31, 2))).toBe('2026-02-28');
    });


    it('identifies ISO week start (Monday) consistently', () => {
      // 2026-08-15 is Saturday
      const sat = parseIsoDate('2026-08-15');
      expect(formatIsoDate(startOfIsoWeek(sat))).toBe('2026-08-10'); // Monday

      // 2026-08-16 is Sunday -> still belongs to the week starting Monday 2026-08-10
      const sun = parseIsoDate('2026-08-16');
      expect(formatIsoDate(startOfIsoWeek(sun))).toBe('2026-08-10');

      // 2026-08-17 is next Monday
      const mon = parseIsoDate('2026-08-17');
      expect(formatIsoDate(startOfIsoWeek(mon))).toBe('2026-08-17');
    });
  });

  describe('generateDateBuckets', () => {
    it('generates day buckets with zero off-by-one errors for full month', () => {
      const buckets = generateDateBuckets('2026-08-01', '2026-08-31', 'day');
      expect(buckets).toHaveLength(31);
      expect(buckets[0]).toBe('2026-08-01');
      expect(buckets[30]).toBe('2026-08-31');
    });

    it('generates day buckets for leap year February', () => {
      const buckets = generateDateBuckets('2024-02-01', '2024-02-29', 'day');
      expect(buckets).toHaveLength(29);
      expect(buckets[0]).toBe('2024-02-01');
      expect(buckets[28]).toBe('2024-02-29');
    });

    it('generates single day bucket when from === to', () => {
      const buckets = generateDateBuckets('2026-08-15', '2026-08-15', 'day');
      expect(buckets).toEqual(['2026-08-15']);
    });

    it('generates empty array if from > to', () => {
      const buckets = generateDateBuckets('2026-08-31', '2026-08-01', 'day');
      expect(buckets).toEqual([]);
    });

    it('generates week buckets correctly', () => {
      // 2026-08-01 is Saturday (week starts 2026-07-27)
      // 2026-08-31 is Monday (week starts 2026-08-31)
      const buckets = generateDateBuckets('2026-08-01', '2026-08-31', 'week');
      expect(buckets[0]).toBe('2026-07-27');
      expect(buckets[buckets.length - 1]).toBe('2026-08-31');
      expect(buckets).toHaveLength(6);
    });

    it('generates month buckets across multi-month period', () => {
      const buckets = generateDateBuckets('2026-01-15', '2026-04-10', 'month');
      expect(buckets).toEqual([
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
        '2026-04-01',
      ]);
    });

    it('generates year buckets across years', () => {
      const buckets = generateDateBuckets('2024-05-01', '2026-08-01', 'year');
      expect(buckets).toEqual(['2024-01-01', '2025-01-01', '2026-01-01']);
    });
  });

  describe('calculatePreviousPeriod', () => {
    it('calculates exact previous month period (31 days to 31 days)', () => {
      // August has 31 days: 2026-08-01 to 2026-08-31
      // Previous period should be July 1 to July 31 (31 days)
      const prev = calculatePreviousPeriod('2026-08-01', '2026-08-31');
      expect(prev).toEqual({
        from: '2026-07-01',
        to: '2026-07-31',
      });
    });

    it('calculates single day previous period', () => {
      const prev = calculatePreviousPeriod('2026-08-15', '2026-08-15');
      expect(prev).toEqual({
        from: '2026-08-14',
        to: '2026-08-14',
      });
    });

    it('calculates 7-day previous week period', () => {
      const prev = calculatePreviousPeriod('2026-08-08', '2026-08-14');
      expect(prev).toEqual({
        from: '2026-08-01',
        to: '2026-08-07',
      });
    });

    it('handles leap year boundaries in previous period', () => {
      // 2024-03-01 to 2024-03-05 (5 days)
      // Preceding 5 days should be 2024-02-25 to 2024-02-29
      const prev = calculatePreviousPeriod('2024-03-01', '2024-03-05');
      expect(prev).toEqual({
        from: '2024-02-25',
        to: '2024-02-29',
      });
    });
  });
});

describe('Time-zone aware "today"', () => {
  it('returns the Tashkent calendar day even when UTC is still on the previous day', () => {
    // 2026-09-26T21:30Z is 02:30 on the 27th in Tashkent (UTC+5).
    const instant = new Date('2026-09-26T21:30:00.000Z');
    expect(todayInTimeZone('Asia/Tashkent', instant)).toBe('2026-09-27');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-09-26');
  });

  it('diffInDays counts calendar days in both directions', () => {
    expect(diffInDays('2026-02-27', '2026-03-01')).toBe(2);
    expect(diffInDays('2026-03-01', '2026-02-27')).toBe(-2);
    expect(diffInDays('2026-09-27', '2026-09-27')).toBe(0);
  });
});
