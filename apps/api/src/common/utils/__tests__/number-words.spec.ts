import { isLastDayOfMonth, numberToWordsRu, numberToWordsUz } from '@fintrack/shared';

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

describe('numberToWordsRu', () => {
  it.each([
    [0, 'ноль'],
    [7, 'семь'],
    [12, 'двенадцать'],
    [40, 'сорок'],
    [101, 'сто один'],
    [250, 'двести пятьдесят'],
    [1_000, 'одна тысяча'],
    [2_000, 'две тысячи'],
    [5_000, 'пять тысяч'],
    [21_000, 'двадцать одна тысяча'],
    [45_000, 'сорок пять тысяч'],
    [111_000, 'сто одиннадцать тысяч'],
    [1_250_000, 'один миллион двести пятьдесят тысяч'],
    [3_000_001, 'три миллиона один'],
    [12_000_000, 'двенадцать миллионов'],
    [2_000_000_000, 'два миллиарда'],
  ])('%d → %s', (value, words) => {
    expect(numberToWordsRu(value)).toBe(words);
  });

  it('agrees the last word with a feminine noun, and only the last', () => {
    expect(numberToWordsRu(1, 'feminine')).toBe('одна');
    expect(numberToWordsRu(42, 'feminine')).toBe('сорок две');
    expect(numberToWordsRu(2_002, 'feminine')).toBe('две тысячи две');
    expect(numberToWordsRu(2_000_001, 'feminine')).toBe('два миллиона одна');
  });

  it('refuses what is not a whole number from zero up', () => {
    expect(() => numberToWordsRu(-1)).toThrow(RangeError);
    expect(() => numberToWordsRu(2.5)).toThrow(RangeError);
  });
});
