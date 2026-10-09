import { describe, expect, it } from 'vitest';
import { bucketLabel, bucketTitle, changePercent, formatBytes, formatCount, formatUptime, percentOf } from './format';

const NBSP = String.fromCharCode(0x00a0);

describe('admin format', () => {
  it('groups counts and works out shares and changes', () => {
    expect(formatCount(1234567)).toBe(`1${NBSP}234${NBSP}567`);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBe(0);
    expect(changePercent(15, 10)).toBe(50);
    expect(changePercent(3, 0)).toBeNull();
    expect(changePercent(0, 0)).toBe(0);
  });

  it('names buckets by day, week and month', () => {
    expect(bucketLabel('2026-10-05', 'week')).toBe('5-okt');
    expect(bucketLabel('2026-10-01', 'month')).toBe('okt');
    expect(bucketTitle('2026-09-28', 'week')).toBe('28-sentabr – 4-oktabr, 2026 haftasi');
    expect(bucketTitle('2026-10-01', 'month')).toBe('Oktabr 2026');
  });

  it('writes sizes and uptime for people', () => {
    expect(formatBytes(52_428_800)).toBe(`50${NBSP}MB`);
    expect(formatBytes(1_610_612_736)).toBe(`1,5${NBSP}GB`);
    expect(formatUptime(93_600)).toBe('1 kun 2 soat');
    expect(formatUptime(2_400)).toBe('40 daqiqa');
  });
});
