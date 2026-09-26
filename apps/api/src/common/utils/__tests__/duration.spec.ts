import { durationToMs } from '../duration';

describe('durationToMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
  ])('%s -> %i ms', (input, expected) => {
    expect(durationToMs(input)).toBe(expected);
  });

  it('rejects malformed values', () => {
    expect(() => durationToMs('7 days')).toThrow();
  });
});
