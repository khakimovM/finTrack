import { describe, expect, it } from 'vitest';
import { comparisonFor, formatRange } from './periods';

describe('comparisonFor', () => {
  it('compares a month in progress with the same days of the previous month', () => {
    expect(comparisonFor('this_month', '2026-09-28')).toEqual({
      current: { from: '2026-09-01', to: '2026-09-28' },
      previous: { from: '2026-08-01', to: '2026-08-28' },
    });
  });

  it('clamps to the end of a shorter previous month', () => {
    expect(comparisonFor('this_month', '2026-03-31').previous).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('compares whole months for the last month', () => {
    expect(comparisonFor('last_month', '2026-03-15')).toEqual({
      current: { from: '2026-02-01', to: '2026-02-28' },
      previous: { from: '2026-01-01', to: '2026-01-31' },
    });
  });

  it('compares the year so far with the same part of last year, leap day included', () => {
    expect(comparisonFor('this_year', '2026-09-28')).toEqual({
      current: { from: '2026-01-01', to: '2026-09-28' },
      previous: { from: '2025-01-01', to: '2025-09-28' },
    });
    expect(comparisonFor('this_year', '2028-02-29').previous.to).toBe('2027-02-28');
  });

  it('compares a custom range with the equally long range right before it', () => {
    expect(
      comparisonFor('custom', '2026-09-28', { from: '2026-08-01', to: '2026-08-31' }).previous,
    ).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });
});

describe('formatRange', () => {
  it('prints one date for a single day and a span otherwise', () => {
    expect(formatRange({ from: '2026-09-28', to: '2026-09-28' })).toBe('28-sentabr, 2026');
    expect(formatRange({ from: '2026-09-01', to: '2026-09-28' })).toBe(
      '1-sentabr, 2026 – 28-sentabr, 2026',
    );
  });
});
