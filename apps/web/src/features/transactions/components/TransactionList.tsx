import { Lock } from 'lucide-react';
import type { TransactionResponse } from '@fintrack/shared';
import { Amount } from '../../../components/ui/Amount';
import { Checkbox } from '../../../components/ui/Checkbox';
import { TagChip } from '../../../components/ui/Chip';
import { formatDayHeader, formatShortDate, formatTime } from '../../../lib/format';
import { formatAmount } from '../../../lib/money';
import { cn } from '../../../lib/utils';
import { TYPE_LABELS } from '../typeLabels';
import { TxTile, rowKind, rowNote, rowSubtitle, rowTitle } from '../rowView';
import { TransactionRowMenu, type RowActions } from './TransactionRowMenu';

export interface TransactionListProps {
  transactions: TransactionResponse[];
  /** Day headers while sorted by date; amount sorts show one flat list. */
  grouped: boolean;
  today: string;
  /** Child category id → parent name. */
  parents: Map<string, string>;
  actions: RowActions & { onOpen: (tx: TransactionResponse) => void };
  /** Desktop only: bulk selection of incomes and expenses. */
  selection?: { ids: Set<string>; toggle: (id: string) => void; toggleAll: () => void };
  variant: 'table' | 'cards';
}

interface DayGroup {
  day: string | null;
  net: bigint;
  rows: TransactionResponse[];
}

/** Days in list order; the net counts only incomes and expenses on this page. */
export function groupByDay(rows: TransactionResponse[], grouped: boolean): DayGroup[] {
  if (!grouped) return [{ day: null, net: 0n, rows }];
  const groups: DayGroup[] = [];
  for (const tx of rows) {
    let group = groups[groups.length - 1];
    if (!group || group.day !== tx.date) {
      group = { day: tx.date, net: 0n, rows: [] };
      groups.push(group);
    }
    group.rows.push(tx);
    if (tx.type === 'INCOME') group.net += BigInt(tx.amount);
    if (tx.type === 'EXPENSE') group.net -= BigInt(tx.amount);
  }
  return groups;
}

const TABLE_COLS = 'grid-cols-[20px_92px_minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1.5fr)_150px_32px]';

function DayHeader({ group, today, table }: { group: DayGroup; today: string; table: boolean }) {
  if (!group.day) return null;
  return (
    <div
      className={cn(
        'flex h-9 items-center justify-between gap-3 border-b border-border text-[12.5px] font-semibold text-text-secondary',
        table ? 'bg-surface px-4' : 'px-0',
      )}
    >
      <span className="truncate">{formatDayHeader(group.day, today)}</span>
      <span
        className={cn(
          'whitespace-nowrap font-medium',
          group.net > 0n ? 'text-income' : group.net < 0n ? 'text-expense' : 'text-text-muted',
        )}
      >
        {formatAmount(group.net, { sign: 'auto' })}
      </span>
    </div>
  );
}

function SystemLock({ compact }: { compact?: boolean }) {
  return (
    <span className="group relative flex">
      <span
        aria-label="Tizim yozuvi"
        title="Tizim yozuvi"
        className={cn('flex h-8 w-8 items-center justify-center text-text-muted', compact && '-mr-1.5 mt-1')}
      >
        <Lock className="h-4 w-4" aria-hidden />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[38px] right-0 hidden whitespace-nowrap rounded-[8px] bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground shadow-md group-hover:block"
      >
        Tizim yozuvi
      </span>
    </span>
  );
}

export function TransactionList({ transactions, grouped, today, parents, actions, selection, variant }: TransactionListProps) {
  const table = variant === 'table';
  const groups = groupByDay(transactions, grouped);
  const selectable = transactions.filter((tx) => rowKind(tx) === 'entry');
  const selectedOnPage = selectable.filter((tx) => selection?.ids.has(tx.id)).length;
  const when = (tx: TransactionResponse) => (grouped ? formatTime(tx.createdAt) : `${formatShortDate(tx.date)}, ${formatTime(tx.createdAt)}`);
  const open = (tx: TransactionResponse) => {
    if (rowKind(tx) !== 'adjustment') actions.onOpen(tx);
  };

  return (
    <div className="flex flex-col">
      {table && (
        <div
          className={cn(
            'grid h-11 items-center gap-3 border-b border-border px-4 text-[12px] font-medium text-text-muted',
            TABLE_COLS,
          )}
        >
          {selection ? (
            <Checkbox
              aria-label="Barchasini tanlash"
              checked={selectable.length > 0 && selectedOnPage === selectable.length}
              indeterminate={selectedOnPage > 0 && selectedOnPage < selectable.length}
              disabled={selectable.length === 0}
              onChange={selection.toggleAll}
            />
          ) : (
            <span />
          )}
          <span>Sana</span>
          <span>Hisob</span>
          <span>Kategoriya / Tur</span>
          <span>Izoh</span>
          <span className="text-right">Summa</span>
          <span />
        </div>
      )}
      {groups.map((group) => (
        <div key={group.day ?? 'all'}>
          <DayHeader group={group} today={today} table={table} />
          {group.rows.map((tx) => {
            const kind = rowKind(tx);
            const checked = selection?.ids.has(tx.id) ?? false;
            const parent = tx.category ? parents.get(tx.category.id) : undefined;
            const menu = kind === 'adjustment' ? <SystemLock compact={!table} /> : <TransactionRowMenu tx={tx} when={when(tx)} actions={actions} size={table ? 'sm' : 'md'} />;

            if (!table) {
              return (
                <div
                  key={tx.id}
                  onClick={() => open(tx)}
                  className={cn('flex items-start gap-3 border-b border-border py-3', kind !== 'adjustment' && 'cursor-pointer')}
                >
                  <TxTile tx={tx} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-5">{rowTitle(tx)}</span>
                      <Amount value={tx.amount} type={tx.type} className="text-[15px] font-semibold" />
                    </div>
                    <span className="truncate text-[12.5px] leading-[17px] text-text-muted">{rowSubtitle(tx, when(tx))}</span>
                    {tx.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tx.tags.map((tag) => (
                          <TagChip key={tag.id} name={tag.name} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="-mr-2 mt-0.5 shrink-0">{menu}</div>
                </div>
              );
            }

            return (
              <div
                key={tx.id}
                onClick={() => open(tx)}
                className={cn(
                  'grid min-h-[58px] items-center gap-3 border-b border-border px-4 py-1.5 text-[14px] transition-colors duration-fast hover:bg-surface',
                  TABLE_COLS,
                  kind !== 'adjustment' && 'cursor-pointer',
                  checked && 'bg-[color-mix(in_srgb,var(--info)_7%,transparent)]',
                )}
              >
                {selection && kind === 'entry' ? (
                  <Checkbox aria-label="Tanlash" checked={checked} onChange={() => selection.toggle(tx.id)} />
                ) : (
                  <span />
                )}
                <span className="whitespace-nowrap text-text-secondary">{when(tx)}</span>
                <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                  <span className="text-[15px]" aria-hidden>
                    {tx.account.icon}
                  </span>
                  <span className="truncate">{tx.account.name}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <TxTile tx={tx} size={30} />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn('truncate font-medium', kind === 'debt' ? 'text-debt' : 'text-text')}>
                      {kind === 'entry' ? tx.category?.name ?? TYPE_LABELS[tx.type] : TYPE_LABELS[tx.type]}
                    </span>
                    {kind === 'entry' && parent && <span className="truncate text-[12px] leading-4 text-text-muted">{parent}</span>}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('truncate', kind === 'debt' && 'font-semibold')}>{rowNote(tx)}</span>
                  {tx.tags.map((tag) => (
                    <TagChip key={tag.id} name={tag.name} className="shrink-0" />
                  ))}
                </span>
                <Amount value={tx.amount} type={tx.type} className="justify-self-end font-semibold" />
                <div className="flex justify-end">{menu}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
