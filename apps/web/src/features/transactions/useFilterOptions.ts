import { useMemo } from 'react';
import { TransactionTypeSchema } from '@fintrack/shared';
import type { DropdownOption } from '../../components/ui/Dropdown';
import { formatRange } from '../../lib/format';
import { formatAmountNumber } from '../../lib/money';
import { useAccounts } from '../accounts/hooks/useAccounts';
import { useCategories } from '../categories/hooks/useCategories';
import { useTags } from '../tags/hooks/useTags';
import { PERIOD_OPTIONS, type TxFilters } from './filters';
import { TYPE_LABELS } from './typeLabels';

export type SelectKey = 'type' | 'accountId' | 'categoryId' | 'tagId' | 'period';

export interface FilterSelect {
  key: SelectKey;
  label: string;
  /** Shown on the trigger when nothing is chosen. */
  all: string;
  options: DropdownOption[];
}

export interface ActiveChip {
  key: string;
  label: string;
  value: string;
  clear: Partial<TxFilters>;
}

/** "1 000 000" from whole so‘m digits. */
export const groupSom = (som: string) => (som ? formatAmountNumber(`${som}00`) : '');

/** The five filter dropdowns and the chips of whatever is active. */
export function useFilterOptions(filters: TxFilters) {
  const { data: accountsData } = useAccounts();
  const { data: tree = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const accounts = accountsData?.data;

  const selects = useMemo<FilterSelect[]>(() => {
    // Expense categories first; an income parent says so, since names can repeat across types.
    const parents = [...tree].sort((a, b) => Number(a.type === 'INCOME') - Number(b.type === 'INCOME'));
    const categoryOptions: DropdownOption[] = parents.flatMap((parent) => [
      { value: parent.id, label: parent.type === 'INCOME' ? `${parent.name} (kirim)` : parent.name, icon: parent.icon },
      ...(parent.children ?? []).map((child) => ({ value: child.id, label: child.name, icon: child.icon, depth: 1 as const })),
    ]);
    const periodOptions: DropdownOption[] = PERIOD_OPTIONS.map((p) => ({ value: p.value, label: p.label }));
    if (filters.period === 'custom') {
      periodOptions.push({ value: 'custom', label: customRangeLabel(filters) });
    }
    return [
      {
        key: 'type',
        label: 'Tur',
        all: 'Barcha turlar',
        options: [
          { value: '', label: 'Barcha turlar' },
          ...TransactionTypeSchema.options.map((type) => ({ value: type, label: TYPE_LABELS[type] })),
        ],
      },
      {
        key: 'accountId',
        label: 'Hisob',
        all: 'Barcha hisoblar',
        options: [{ value: '', label: 'Barcha hisoblar' }, ...(accounts ?? []).map((a) => ({ value: a.id, label: a.name, icon: a.icon }))],
      },
      { key: 'categoryId', label: 'Kategoriya', all: 'Barcha kategoriyalar', options: [{ value: '', label: 'Barcha kategoriyalar' }, ...categoryOptions] },
      {
        key: 'tagId',
        label: 'Teg',
        all: 'Barcha teglar',
        options: [{ value: '', label: 'Barcha teglar' }, ...tags.map((t) => ({ value: t.id, label: `#${t.name}`, icon: '#' }))],
      },
      { key: 'period', label: 'Sana', all: 'Barcha sanalar', options: periodOptions },
    ];
  }, [tree, accounts, tags, filters]);

  const chips: ActiveChip[] = [];
  if (filters.search.trim()) chips.push({ key: 'search', label: 'Qidiruv', value: `“${filters.search.trim()}”`, clear: { search: '' } });
  for (const select of selects) {
    const value = filters[select.key];
    if (!value) continue;
    // An id the lists do not know (yet, or any more) still shows, so it can be removed.
    const label = select.options.find((o) => o.value === value)?.label ?? '…';
    const clear: Partial<TxFilters> = select.key === 'period' ? { period: '', from: '', to: '' } : { [select.key]: '' };
    chips.push({ key: select.key, label: select.label, value: label, clear });
  }
  if (filters.min || filters.max) {
    const value =
      filters.min && filters.max
        ? `${groupSom(filters.min)} — ${groupSom(filters.max)}`
        : filters.min
          ? `${groupSom(filters.min)} dan`
          : `${groupSom(filters.max)} gacha`;
    chips.push({ key: 'amount', label: 'Summa', value, clear: { min: '', max: '' } });
  }

  return { selects, chips };
}

function customRangeLabel(filters: TxFilters): string {
  if (filters.from && filters.to) return formatRange(filters.from, filters.to);
  if (filters.from) return `${formatRange(filters.from, filters.from)} dan`;
  return `${formatRange(filters.to, filters.to)} gacha`;
}
