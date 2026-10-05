import { describe, expect, it } from 'vitest';
import type { TransactionResponse } from '@fintrack/shared';
import { changePercent, flowPoints, hourlyPoints } from './periods';
import { groupByForRange, presetRange } from '../../stores/periodStore';

const DASH = String.fromCharCode(0x2013);
const item = (bucket: string, income = '0', expense = '0') => ({ bucket, income, expense, net: '0' });

describe('dashboard periods', () => {
  it('uses whole calendar weeks, months and years', () => {
    expect(presetRange('this_week', '2026-10-03')).toEqual({ from: '2026-09-28', to: '2026-10-04', groupBy: 'day' });
    expect(presetRange('this_month', '2026-10-03')).toEqual({ from: '2026-10-01', to: '2026-10-31', groupBy: 'week' });
    expect(presetRange('this_year', '2026-10-03')).toEqual({ from: '2026-01-01', to: '2026-12-31', groupBy: 'month' });
    expect(groupByForRange('2026-10-01', '2026-10-15')).toBe('day');
    expect(groupByForRange('2026-06-01', '2026-08-15')).toBe('week');
    expect(groupByForRange('2026-01-01', '2026-08-15')).toBe('month');
  });

  it('computes change chips without floats on money', () => {
    expect(changePercent(10_920n, 10_000n)).toBe(9.2);
    expect(changePercent(9_000n, 10_000n)).toBe(-10);
    expect(changePercent(500n, 0n)).toBeNull();
    expect(changePercent(0n, 0n)).toBe(0);
  });

  it('labels weekly buckets of a month clipped to the month', () => {
    const points = flowPoints(
      [item('2026-09-28', '100000'), item('2026-10-05'), item('2026-10-26', '0', '5000000')],
      'week',
      { from: '2026-10-01', to: '2026-10-31', preset: 'this_month' },
      '2026-10-03',
    );
    expect(points.map((p) => p.label)).toEqual([`1${DASH}4`, `5${DASH}11`, `26${DASH}31`]);
    expect(points[0].title).toBe(`1${DASH}4-oktabr`);
    expect(points[0].income).toBe(1000);
    expect(points[2].expense).toBe(50000);
  });

  it('draws the year to date with month names and weeks as weekdays', () => {
    const year = flowPoints(
      [item('2026-01-01'), item('2026-10-01'), item('2026-11-01')],
      'month',
      { from: '2026-01-01', to: '2026-12-31', preset: 'this_year' },
      '2026-10-03',
    );
    expect(year.map((p) => p.label)).toEqual(['Yan', 'Okt']);
    expect(year[1].title).toBe('Oktabr 2026');

    const week = flowPoints([item('2026-09-28')], 'day', { from: '2026-09-28', to: '2026-10-04', preset: 'this_week' }, '2026-10-03');
    expect(week[0]).toMatchObject({ label: 'Du', title: '28-sentabr, dushanba' });
  });

  it('buckets today by recording hour and skips managed entries', () => {
    const at = (hour: number) => new Date(2026, 9, 3, hour, 15).toISOString();
    const tx = (type: string, amount: string, hour: number) => ({ type, amount, date: '2026-10-03', createdAt: at(hour) }) as TransactionResponse;
    const points = hourlyPoints([tx('EXPENSE', '3500000', 9), tx('INCOME', '100000', 9), tx('TRANSFER_OUT', '999', 9)], '2026-10-03');
    expect(points).toHaveLength(12);
    expect(points[4]).toMatchObject({ label: '08', expense: 35000, income: 1000 });
  });
});
