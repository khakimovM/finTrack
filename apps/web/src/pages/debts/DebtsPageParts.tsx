import type { DebtResponse, DebtSummary } from '@fintrack/shared';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatAmount, formatAmountNumber } from '../../lib/money';
import { cn } from '../../lib/utils';
import { DEBT_FILTERS, matchesFilter, type DebtFilter } from '../../features/debts/debtView';

export type Direction = 'I_LENT' | 'I_BORROWED';

function DirectionCard({
  direction,
  amount,
  selected,
  onToggle,
}: {
  direction: Direction;
  amount: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const lent = direction === 'I_LENT';
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-[20px] border bg-card p-4 text-left transition-colors duration-fast focus-ring sm:p-5',
        selected ? 'border-ring shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]' : 'border-border hover:border-input',
      )}
    >
      <span className="flex items-center gap-2 text-[14px] font-medium text-text-secondary">
        <span className={cn('h-2 w-2 rounded-full', lent ? 'bg-debt' : 'bg-text-secondary')} aria-hidden />
        {lent ? 'Menga qarzdor' : 'Men qarzdorman'}
      </span>
      <span
        className={cn(
          'whitespace-nowrap text-[19px] font-semibold leading-[1.2] tracking-[-0.02em] tabular-nums sm:text-[28px]',
          lent ? 'text-debt' : 'text-text',
        )}
      >
        {formatAmountNumber(amount)} <span className="text-[13px] font-medium tracking-normal text-text-muted">so‘m</span>
      </span>
      <span className="text-[12.5px] leading-[17px] text-text-muted">{lent ? 'Kutilayotgan qaytuvlar' : 'To‘lanishi kerak'}</span>
    </button>
  );
}

/** Who owes whom in total; the two cards also filter the list by direction. */
export function DebtsSummary({
  summary,
  direction,
  onDirection,
}: {
  summary: DebtSummary;
  direction: Direction | null;
  onDirection: (next: Direction | null) => void;
}) {
  const net = BigInt(summary.net);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px] lg:gap-4">
      {(['I_LENT', 'I_BORROWED'] as const).map((d) => (
        <DirectionCard
          key={d}
          direction={d}
          amount={d === 'I_LENT' ? summary.owedToMe : summary.iOwe}
          selected={direction === d}
          onToggle={() => onDirection(direction === d ? null : d)}
        />
      ))}
      <div className="col-span-2 flex flex-row justify-between gap-3 rounded-[20px] border border-border bg-surface p-4 sm:p-5 lg:col-span-1 lg:flex-col">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-text-muted">Saldo</span>
          <span className={cn('whitespace-nowrap text-[18px] font-semibold tabular-nums', net >= 0n ? 'text-debt' : 'text-danger')}>
            {formatAmount(net, { sign: 'auto' })}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-text-muted">Muddati o‘tgan</span>
          <span className={cn('text-[18px] font-semibold', summary.overdueCount > 0 ? 'text-danger' : 'text-text')}>
            {summary.overdueCount} ta
          </span>
        </div>
      </div>
    </div>
  );
}

/** Status filter chips with how many debts each would show. */
export function DebtFilters({
  debts,
  value,
  onChange,
}: {
  /** Already narrowed to the chosen direction. */
  debts: DebtResponse[];
  value: DebtFilter;
  onChange: (next: DebtFilter) => void;
}) {
  return (
    <div role="group" aria-label="Holat" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
      {DEBT_FILTERS.map((filter) => {
        const on = filter.value === value;
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(filter.value)}
            className={cn(
              'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-medium focus-ring',
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-text hover:bg-secondary',
            )}
          >
            {filter.label}
            <span className="text-[12px] opacity-70">{debts.filter((d) => matchesFilter(d, filter.value)).length}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DebtsSkeleton() {
  return (
    <div role="status" aria-label="Yuklanmoqda" className="grid gap-4 lg:grid-cols-[repeat(auto-fill,minmax(440px,1fr))]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-5">
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-[13px] w-[55%] rounded-[6px]" />
              <Skeleton className="h-[11px] w-[30%] rounded-[6px]" />
            </div>
          </div>
          <Skeleton className="h-2 rounded-full" />
        </div>
      ))}
    </div>
  );
}
