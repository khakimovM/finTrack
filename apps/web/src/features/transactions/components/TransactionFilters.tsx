import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, SlidersHorizontal } from 'lucide-react';
import { SearchInput } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { FilterChip } from '../../../components/ui/Chip';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { useIsMobile } from '../../../lib/useMediaQuery';
import { cn } from '../../../lib/utils';
import { SORT_OPTIONS, activeFilterCount, digitsOnly, type SortKey, type TxFilters } from '../filters';
import { groupSom, useFilterOptions } from '../useFilterOptions';

export interface TransactionFiltersProps {
  filters: TxFilters;
  onChange: (patch: Partial<TxFilters>) => void;
  onClear: () => void;
  /** How many rows the filters match, for "Natijalarni ko‘rsatish (N)". */
  total: number;
}

/** Typing stays local and reaches the URL (and the API) after a pause. */
function useDebounced(value: string, commit: (next: string) => void, delay = 400) {
  const [local, setLocal] = useState(value);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => commitRef.current(local), delay);
    return () => clearTimeout(timer);
    // `value` is left out on purpose: a new value from outside resets `local` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, delay]);

  return [local, setLocal] as const;
}

function AmountInput({ value, onChange, label, mobile }: { value: string; onChange: (v: string) => void; label: string; mobile?: boolean }) {
  return (
    <input
      value={groupSom(value)}
      onChange={(e) => onChange(digitsOnly(e.target.value))}
      inputMode="numeric"
      placeholder={label}
      aria-label={`Summa ${label}`}
      className={cn(
        'min-w-0 bg-secondary text-right font-medium tabular-nums text-text outline-none placeholder:text-text-muted',
        mobile
          ? 'h-12 rounded-md border border-input bg-card px-3.5 text-[15px] font-normal field-focus'
          : 'h-7 w-[86px] rounded-full px-2 text-[13px] focus-visible:ring-2 focus-visible:ring-ring',
      )}
    />
  );
}

export function TransactionFilters({ filters, onChange, onClear, total }: TransactionFiltersProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { selects, chips } = useFilterOptions(filters);
  const [search, setSearch] = useDebounced(filters.search, (next) => onChange({ search: next }));
  const [min, setMin] = useDebounced(filters.min, (next) => onChange({ min: next }), 500);
  const [max, setMax] = useDebounced(filters.max, (next) => onChange({ max: next }), 500);
  const count = activeFilterCount(filters);

  const pick = (key: (typeof selects)[number]['key'], value: string) =>
    onChange(key === 'period' ? { period: value as TxFilters['period'], from: '', to: '' } : { [key]: value });

  const chipRow = chips.length > 0 && (
    <div
      className={cn(
        'flex items-center gap-1.5',
        isMobile ? '-mx-4 flex-nowrap overflow-x-auto px-4 scrollbar-none' : 'flex-wrap',
      )}
    >
      {chips.map((chip) => (
        <FilterChip key={chip.key} label={chip.label} value={chip.value} onRemove={() => onChange(chip.clear)} />
      ))}
      <button
        type="button"
        onClick={onClear}
        className="h-8 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium text-text underline decoration-input underline-offset-[3px] hover:decoration-text focus-ring"
      >
        Filtrlarni tozalash
      </button>
    </div>
  );

  const sortControl = (
    <Dropdown
      variant="pill"
      plain
      aria-label="Saralash"
      icon={<ArrowDownUp className="h-4 w-4 text-text-muted" aria-hidden />}
      value={filters.sort}
      onChange={(value) => onChange({ sort: value as SortKey })}
      options={SORT_OPTIONS}
      align="end"
      className="h-11 gap-2 pl-4 pr-3.5 text-[14px]"
      listClassName="w-[230px]"
    />
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Izoh bo‘yicha qidiruv..."
          aria-label="Izoh bo‘yicha qidiruv"
          className="min-w-0 flex-[1_1_200px] sm:flex-[1_1_280px]"
        />
        {isMobile ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              'flex h-11 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-[14px] font-medium text-text focus-ring',
              count > 0 ? 'border-text bg-secondary' : 'border-input bg-card',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {count > 0 ? `Filtrlar (${count})` : 'Filtrlar'}
          </button>
        ) : (
          sortControl
        )}
      </div>

      {!isMobile && (
        <div className="flex flex-wrap gap-2">
          {selects.map((select) => (
            <Dropdown
              key={select.key}
              variant="pill"
              aria-label={select.label}
              placeholder={select.all}
              emptyValue=""
              value={filters[select.key]}
              onChange={(value) => pick(select.key, value)}
              options={select.options}
              listClassName="max-h-[380px]"
            />
          ))}
          <div
            className={cn(
              'flex h-[38px] items-center gap-1 whitespace-nowrap rounded-full border pl-3.5 pr-1.5 text-[13.5px] font-medium',
              filters.min || filters.max ? 'border-text bg-secondary' : 'border-input bg-card',
            )}
          >
            Summa:
            <AmountInput value={min} onChange={setMin} label="dan" />
            <span className="text-text-muted">—</span>
            <AmountInput value={max} onChange={setMax} label="gacha" />
          </div>
        </div>
      )}

      {chipRow}

      {isMobile && (
        <Sheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filtrlar"
          full
          bodyClassName="flex flex-col gap-3.5"
          footerClassName="grid-cols-[auto_minmax(0,1fr)] gap-2"
          footer={
            <>
              <Button variant="secondary" size="lg" onClick={onClear}>
                Tozalash
              </Button>
              <Button size="lg" onClick={() => setSheetOpen(false)}>
                Natijalarni ko‘rsatish ({total})
              </Button>
            </>
          }
        >
          {selects.map((select) => (
            <Dropdown
              key={select.key}
              inline
              label={select.label}
              placeholder={select.all}
              value={filters[select.key]}
              onChange={(value) => pick(select.key, value)}
              options={select.options}
              listClassName="max-h-[300px]"
            />
          ))}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-secondary">Summa</span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <AmountInput value={min} onChange={setMin} label="dan" mobile />
              <span className="text-text-muted">—</span>
              <AmountInput value={max} onChange={setMax} label="gacha" mobile />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-secondary">Saralash</span>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((option) => {
                const on = filters.sort === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ sort: option.value })}
                    className={cn(
                      'h-10 rounded-full border px-3.5 text-[14px] font-medium focus-ring',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-text',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
