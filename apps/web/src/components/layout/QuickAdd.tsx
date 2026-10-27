import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Users, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFormStore, type GlobalForm } from '../../stores/formStore';
import { Sheet } from '../ui/Sheet';
import { t, type TextKey } from '../../lib/i18n';

interface QuickAddItem {
  label: TextKey;
  hint: TextKey;
  icon: LucideIcon;
  /** Label and icon colour, tile background. */
  tone: string;
  tile: string;
  form: GlobalForm;
}

export const QUICK_ADD_ITEMS: QuickAddItem[] = [
  { label: 'common.expense', hint: 'quickAdd.expenseHint', icon: ArrowUpRight, tone: 'text-expense', tile: 'bg-danger-soft', form: { kind: 'transaction', type: 'EXPENSE' } },
  { label: 'common.income', hint: 'quickAdd.incomeHint', icon: ArrowDownLeft, tone: 'text-income', tile: 'bg-success-soft', form: { kind: 'transaction', type: 'INCOME' } },
  { label: 'common.transfer', hint: 'quickAdd.transferHint', icon: ArrowLeftRight, tone: 'text-text', tile: 'bg-secondary', form: { kind: 'transfer' } },
  { label: 'common.debt', hint: 'quickAdd.debtHint', icon: Users, tone: 'text-debt', tile: 'bg-debt-soft', form: { kind: 'debt' } },
];

/** The four choices; `large` is the phone sheet's bigger tile. */
export function QuickAddGrid({ onChosen, large = false }: { onChosen: () => void; large?: boolean }) {
  const open = useFormStore((s) => s.open);
  return (
    <div className={cn('grid grid-cols-2', large ? 'gap-2.5' : 'gap-2')}>
      {QUICK_ADD_ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            onChosen();
            open(item.form);
          }}
          className={cn(
            'flex flex-col items-start justify-between border border-border bg-card p-3.5 text-left transition-colors duration-fast hover:border-input hover:bg-surface focus-ring',
            large ? 'min-h-[124px] rounded-xl' : 'min-h-[112px] rounded-lg',
          )}
        >
          <span className={cn('flex items-center justify-center', item.tile, item.tone, large ? 'h-11 w-11 rounded-[14px]' : 'h-10 w-10 rounded-md')}>
            <item.icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className={cn('font-semibold', item.tone, large ? 'text-[16px] leading-[22px]' : 'text-[15px] leading-5')}>{t(item.label)}</span>
            <span className="text-[12px] leading-4 text-text-muted">{t(item.hint)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function QuickAddSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('common.add')}>
      <div className="pt-2">
        <QuickAddGrid onChosen={onClose} large />
      </div>
    </Sheet>
  );
}
