import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type EntryType = 'INCOME' | 'EXPENSE';

/** Expense / income switch shared by the transaction and recurring-rule forms. */
export function EntryTypeToggle({
  value,
  onChange,
}: {
  value: EntryType;
  onChange: (type: EntryType) => void;
}) {
  const option = (type: EntryType, label: string, active: string, Icon: typeof ArrowUpRight) => (
    <button
      type="button"
      onClick={() => onChange(type)}
      aria-pressed={value === type}
      className={cn(
        'flex min-h-11 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all duration-150',
        value === type ? active : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/20 p-1">
      {option(
        'EXPENSE',
        'Chiqim (Xarajat)',
        'bg-destructive text-destructive-foreground shadow-sm',
        ArrowDownLeft,
      )}
      {option(
        'INCOME',
        'Kirim (Daromad)',
        'bg-success text-success-foreground shadow-sm',
        ArrowUpRight,
      )}
    </div>
  );
}
