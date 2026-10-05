import {
  ListTransactionsQuery,
  TransactionType,
  TransactionTypeSchema,
  addDays,
  addMonths,
  endOfMonth,
  formatIsoDate,
  parseIsoDate,
  startOfMonth,
} from '@fintrack/shared';

export type PeriodKey = '' | 'last7' | 'thisMonth' | 'lastMonth' | 'last90' | 'custom';
export type SortKey = 'new' | 'old' | 'big' | 'small';

/** Everything the list is filtered by, as kept in the URL. Amounts are whole so‘m. */
export interface TxFilters {
  search: string;
  type: TransactionType | '';
  accountId: string;
  categoryId: string;
  tagId: string;
  period: PeriodKey;
  /** Only for a custom range (links from other pages carry `from`/`to`). */
  from: string;
  to: string;
  min: string;
  max: string;
  sort: SortKey;
  page: number;
}

export const PERIOD_OPTIONS: { value: Exclude<PeriodKey, 'custom'>; label: string }[] = [
  { value: '', label: 'Barcha sanalar' },
  { value: 'last7', label: 'So‘nggi 7 kun' },
  { value: 'thisMonth', label: 'Shu oy' },
  { value: 'lastMonth', label: 'O‘tgan oy' },
  { value: 'last90', label: 'So‘nggi 3 oy' },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'new', label: 'Eng yangi' },
  { value: 'old', label: 'Eng eski' },
  { value: 'big', label: 'Eng katta summa' },
  { value: 'small', label: 'Eng kichik summa' },
];

const SORT_QUERY: Record<SortKey, ListTransactionsQuery['sort']> = {
  new: 'date:desc',
  old: 'date:asc',
  big: 'amount:desc',
  small: 'amount:asc',
};

const PERIODS = new Set<string>(PERIOD_OPTIONS.map((p) => p.value));
const SORTS = new Set<string>(SORT_OPTIONS.map((s) => s.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole so‘m only: what the amount inputs accept. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
}

export function readFilters(params: URLSearchParams): TxFilters {
  const type = params.get('type') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const period = params.get('period') ?? '';
  const sort = params.get('sort') ?? 'new';
  const custom = ISO_DATE.test(from) || ISO_DATE.test(to);
  return {
    search: params.get('search') ?? '',
    type: TransactionTypeSchema.safeParse(type).success ? (type as TransactionType) : '',
    accountId: params.get('accountId') ?? '',
    categoryId: params.get('categoryId') ?? '',
    tagId: params.get('tagId') ?? '',
    period: custom ? 'custom' : PERIODS.has(period) ? (period as PeriodKey) : '',
    from: custom && ISO_DATE.test(from) ? from : '',
    to: custom && ISO_DATE.test(to) ? to : '',
    min: digitsOnly(params.get('min') ?? ''),
    max: digitsOnly(params.get('max') ?? ''),
    sort: SORTS.has(sort) ? (sort as SortKey) : 'new',
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
  };
}

/** Defaults are left out so a clean list has a clean URL. */
export function writeFilters(filters: TxFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string) => {
    if (value) params.set(key, value);
  };
  put('search', filters.search.trim());
  put('type', filters.type);
  put('accountId', filters.accountId);
  put('categoryId', filters.categoryId);
  put('tagId', filters.tagId);
  if (filters.period === 'custom') {
    put('from', filters.from);
    put('to', filters.to);
  } else {
    put('period', filters.period);
  }
  put('min', filters.min);
  put('max', filters.max);
  if (filters.sort !== 'new') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

/** The date range of a preset, both ends inclusive, relative to `today` (YYYY-MM-DD). */
export function periodRange(period: PeriodKey, today: string): { from?: string; to?: string } {
  const day = parseIsoDate(today);
  switch (period) {
    case 'last7':
      return { from: formatIsoDate(addDays(day, -6)), to: today };
    case 'thisMonth':
      return { from: formatIsoDate(startOfMonth(day)), to: today };
    case 'lastMonth': {
      const prev = addMonths(startOfMonth(day), -1);
      return { from: formatIsoDate(prev), to: formatIsoDate(endOfMonth(prev)) };
    }
    case 'last90':
      return { from: formatIsoDate(addDays(day, -89)), to: today };
    default:
      return {};
  }
}

const somToTiyin = (som: string) => (som ? `${som}00` : undefined);

/** The API filter (no paging or sort): shared by the list, the sums and the export. */
export function toApiFilters(filters: TxFilters, today: string) {
  const range = filters.period === 'custom' ? { from: filters.from || undefined, to: filters.to || undefined } : periodRange(filters.period, today);
  return {
    search: filters.search.trim() || undefined,
    type: filters.type || undefined,
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    tagId: filters.tagId || undefined,
    from: range.from,
    to: range.to,
    minAmount: somToTiyin(filters.min),
    maxAmount: somToTiyin(filters.max),
  };
}

/** List query without the page: phones load pages one after another, desktop adds `page`. */
export function toListQuery(filters: TxFilters, today: string, limit = 20): Omit<Partial<ListTransactionsQuery>, 'page'> {
  return { ...toApiFilters(filters, today), sort: SORT_QUERY[filters.sort], limit };
}

/** Clearing keeps the sort: it is how the user reads the list, not what it contains. */
export function clearedFilters(sort: SortKey): TxFilters {
  return { ...readFilters(new URLSearchParams()), sort };
}

/** Filters counted on the "Filtrlar (N)" button; search and sort are not filters there. */
export function activeFilterCount(filters: TxFilters): number {
  return (
    [filters.type, filters.accountId, filters.categoryId, filters.tagId, filters.period].filter(Boolean).length +
    (filters.min || filters.max ? 1 : 0)
  );
}

export function hasAnyFilter(filters: TxFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.search.trim() !== '';
}

/** Day headers only make sense while the list runs by date. */
export function isGroupedByDay(sort: SortKey): boolean {
  return sort === 'new' || sort === 'old';
}
