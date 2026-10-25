import { isLastDayOfMonth, numberToWordsUz } from '@fintrack/shared';

describe('numberToWordsUz', () => {
  it.each([
    [0, 'nol'],
    [7, 'yetti'],
    [15, 'o‘n besh'],
    [40, 'qirq'],
    [100, 'yuz'],
    [101, 'yuz bir'],
    [250, 'ikki yuz ellik'],
    [1_000, 'bir ming'],
    [45_000, 'qirq besh ming'],
    [100_500, 'yuz ming besh yuz'],
    [1_250_000, 'bir million ikki yuz ellik ming'],
    [1_000_001, 'bir million bir'],
    [2_000_000_000, 'ikki milliard'],
  ])('%d → %s', (value, words) => {
    expect(numberToWordsUz(value)).toBe(words);
  });

  it('refuses what is not a whole number from zero up', () => {
    expect(() => numberToWordsUz(-1)).toThrow(RangeError);
    expect(() => numberToWordsUz(1.5)).toThrow(RangeError);
    expect(() => numberToWordsUz(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('isLastDayOfMonth', () => {
  it('knows 30- and 31-day months and February in and out of leap years', () => {
    expect(isLastDayOfMonth('2026-10-31')).toBe(true);
    expect(isLastDayOfMonth('2026-10-30')).toBe(false);
    expect(isLastDayOfMonth('2026-11-30')).toBe(true);
    expect(isLastDayOfMonth('2026-02-28')).toBe(true);
    expect(isLastDayOfMonth('2028-02-28')).toBe(false);
    expect(isLastDayOfMonth('2028-02-29')).toBe(true);
  });
});
