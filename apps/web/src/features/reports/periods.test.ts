import { describe, expect, it } from 'vitest';
import { comparisonFor } from './periods';
import { bucketPlan, sumIntoBuckets } from './buckets';

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

describe('bucketPlan', () => {
  const row = (bucket: string, expense: string) => ({ bucket, income: '0', expense, net: '0' });

  it('cuts a month into weeks of the month, the last one up to its end', () => {
    const plan = bucketPlan('last_month', comparisonFor('last_month', '2026-10-03'));
    expect(plan.groupBy).toBe('day');
    expect(plan.buckets.map((b) => b.label)).toEqual(['1–7', '8–14', '15–21', '22–28', '29–30']);
    expect(plan.buckets[0].title).toBe('1–7-sentabr / avgust');
  });

  it('drops the fifth week in February', () => {
    const plan = bucketPlan('this_month', comparisonFor('this_month', '2027-02-10'));
    expect(plan.buckets.map((b) => b.label)).toEqual(['1–7', '8–14', '15–21', '22–28']);
  });

  it('puts both periods on the same days of the month', () => {
    const comparison = comparisonFor('this_month', '2026-10-20');
    const plan = bucketPlan('this_month', comparison);
    expect(sumIntoBuckets(plan, [row('2026-10-02', '100'), row('2026-10-09', '50'), row('2026-10-03', '1')], comparison.current.from, 'expense')).toEqual([
      101n,
      50n,
      0n,
      0n,
      0n,
    ]);
  });

  it('uses months for a year', () => {
    const plan = bucketPlan('this_year', comparisonFor('this_year', '2026-10-03'));
    expect(plan.groupBy).toBe('month');
    expect(plan.buckets).toHaveLength(12);
    expect(plan.buckets[9]).toEqual({ label: 'Okt', title: 'Oktabr 2026 / 2025' });
    expect(plan.indexOf('2025-10-01', '2025-01-01')).toBe(9);
  });

  it('splits a custom range into up to six stretches by day offset', () => {
    const comparison = comparisonFor('custom', '2026-10-03', { from: '2026-09-01', to: '2026-09-12' });
    const plan = bucketPlan('custom', comparison);
    expect(plan.buckets.map((b) => b.label)).toEqual(['1–2-sen', '3–4-sen', '5–6-sen', '7–8-sen', '9–10-sen', '11–12-sen']);
    // The previous period (20–31 August) lines up by offset, not by date.
    expect(plan.indexOf('2026-08-20', comparison.previous.from)).toBe(0);
    expect(plan.indexOf('2026-08-31', comparison.previous.from)).toBe(5);
  });
});
