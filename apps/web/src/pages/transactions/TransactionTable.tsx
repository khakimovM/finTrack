import { Lock, Trash2 } from 'lucide-react';
import {
  TransactionResponse,
  TransactionType,
  isUserManagedTransactionType,
} from '@fintrack/shared';
import { Amount } from '../../components/ui/Amount';
import { cn } from '../../lib/utils';

export interface TransactionTableProps {
  transactions: TransactionResponse[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Kirim',
  EXPENSE: 'Chiqim',
  TRANSFER_IN: 'O‘tkazma (kirim)',
  TRANSFER_OUT: 'O‘tkazma (chiqim)',
  LOAN_GIVEN: 'Qarz berildi',
  LOAN_TAKEN: 'Qarz olindi',
  LOAN_REPAY_IN: 'Qarz qaytarildi',
  LOAN_REPAY_OUT: 'Qarz to‘landi',
  ADJUSTMENT: 'Tuzatish',
};

/** Transfer and loan rows are managed from their own pages, so they are not deletable here. */
function ManagedHint({ type }: { type: TransactionType }) {
  const where = type.startsWith('TRANSFER') ? 'Hisoblar' : 'Qarzlar';
  return (
    <span
      className="inline-flex p-1.5 text-muted-foreground/60"
      title={`Bu yozuv ${where} bo‘limidan boshqariladi`}
      aria-label={`${where} bo‘limidan boshqariladi`}
    >
      <Lock className="h-4 w-4" />
    </span>
  );
}

export function TransactionTable({
  transactions,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onDelete,
  isDeleting,
}: TransactionTableProps) {
  const selectable = transactions.filter((t) => isUserManagedTransactionType(t.type));
  const allSelected = selectable.length > 0 && selectable.every((t) => selectedIds.has(t.id));

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="w-10 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Sana</th>
              <th className="px-4 py-3">Hisob</th>
              <th className="px-4 py-3">Kategoriya / Tur</th>
              <th className="px-4 py-3">Izoh</th>
              <th className="px-4 py-3 text-right">Summa</th>
              <th className="w-12 px-4 py-3 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((tx) => {
              const isSelected = selectedIds.has(tx.id);
              return (
                <tr
                  key={tx.id}
                  className={cn(
                    'transition-colors hover:bg-muted/10',
                    isSelected && 'bg-primary/5',
                  )}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isUserManagedTransactionType(tx.type)}
                      onChange={() => onToggleSelect(tx.id)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span>{tx.account.icon}</span>
                      <span>{tx.account.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {tx.category ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span>{tx.category.icon}</span>
                        <span>{tx.category.name}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted/50 text-muted-foreground">
                        {TYPE_LABELS[tx.type] ?? tx.type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-xs text-muted-foreground">
                    {tx.note || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Amount value={tx.amount} type={tx.type} className="text-sm" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isUserManagedTransactionType(tx.type) ? (
                      <button
                        onClick={() => onDelete(tx.id)}
                        disabled={isDeleting}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="O‘chirish"
                        aria-label="O‘chirish"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <ManagedHint type={tx.type} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (375px baseline) */}
      <div className="md:hidden flex flex-col gap-2.5">
        {transactions.map((tx) => {
          const isSelected = selectedIds.has(tx.id);
          return (
            <div
              key={tx.id}
              className={cn(
                'p-3.5 rounded-2xl border border-border bg-surface shadow-sm space-y-2 transition-colors',
                isSelected && 'border-primary/50 bg-primary/5',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!isUserManagedTransactionType(tx.type)}
                    onChange={() => onToggleSelect(tx.id)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground font-medium">{tx.date}</span>
                </div>
                <Amount value={tx.amount} type={tx.type} className="text-sm" />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold truncate">
                    {tx.account.icon} {tx.account.name}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  {tx.category ? (
                    <span className="text-xs text-muted-foreground truncate">
                      {tx.category.icon} {tx.category.name}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </span>
                  )}
                </div>

                {isUserManagedTransactionType(tx.type) ? (
                  <button
                    onClick={() => onDelete(tx.id)}
                    disabled={isDeleting}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="O‘chirish"
                    aria-label="O‘chirish"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <ManagedHint type={tx.type} />
                )}
              </div>

              {tx.note && (
                <p className="text-xs text-muted-foreground italic truncate">{tx.note}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
