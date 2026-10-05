import { describe, expect, it } from 'vitest';
import { activeFilterCount, clearedFilters, periodRange, readFilters, toApiFilters, toListQuery, writeFilters } from './filters';

const TODAY = '2026-10-03';

describe('transaction filters in the URL', () => {
  it('round-trips every filter and leaves defaults out', () => {
    const params = new URLSearchParams(
      'search=bozor&type=EXPENSE&accountId=a&categoryId=c&tagId=t&period=lastMonth&min=1000&max=50000&sort=big&page=3',
    );
    expect(writeFilters(readFilters(params)).toString()).toBe(params.toString());
    expect(writeFilters(clearedFilters('new')).toString()).toBe('');
  });

  it('ignores values it does not know instead of sending them to the API', () => {
    const filters = readFilters(new URLSearchParams('type=SALARY&period=forever&sort=random&page=-2&min=12a3'));
    expect(filters).toMatchObject({ type: '', period: '', sort: 'new', page: 1, min: '123' });
  });

  it('treats from/to links from other pages as a custom range', () => {
    const filters = readFilters(new URLSearchParams('from=2026-09-01&to=2026-09-30&period=last7'));
    expect(filters).toMatchObject({ period: 'custom', from: '2026-09-01', to: '2026-09-30' });
    expect(toApiFilters(filters, TODAY)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('periodRange', () => {
  it('turns presets into inclusive date ranges', () => {
    expect(periodRange('last7', TODAY)).toEqual({ from: '2026-09-27', to: TODAY });
    expect(periodRange('thisMonth', TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
    expect(periodRange('lastMonth', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('last90', TODAY)).toEqual({ from: '2026-07-06', to: TODAY });
    expect(periodRange('', TODAY)).toEqual({});
  });

  it('handles the year boundary', () => {
    expect(periodRange('lastMonth', '2027-01-15')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('toListQuery', () => {
  it('sends amounts in tiyin and the sort the API knows', () => {
    const filters = readFilters(new URLSearchParams('min=1000&max=50000&sort=small&search=%20taksi%20'));
    expect(toListQuery(filters, TODAY)).toEqual({
      search: 'taksi',
      type: undefined,
      accountId: undefined,
      categoryId: undefined,
      tagId: undefined,
      from: undefined,
      to: undefined,
      minAmount: '100000',
      maxAmount: '5000000',
      sort: 'amount:asc',
      limit: 20,
    });
  });

  it('counts filters for the phone button, not search or sort', () => {
    expect(activeFilterCount(readFilters(new URLSearchParams('search=a&sort=old')))).toBe(0);
    expect(activeFilterCount(readFilters(new URLSearchParams('type=INCOME&min=5&max=9&period=last7')))).toBe(3);
  });
});
