import { Info, Pencil, Trash2 } from 'lucide-react';
import type { BudgetStatusItem } from '@fintrack/shared';
import { Chip } from '../../../components/ui/Chip';
import { EmojiTile } from '../../../components/ui/EmojiTile';
import { Progress, budgetTone } from '../../../components/ui/Progress';
import { formatAmount, formatAmountNumber } from '../../../lib/money';
import { cn } from '../../../lib/utils';

export const BUDGET_LABEL = { success: 'Meʼyorida', warning: '80% dan oshdi', danger: 'Oshib ketdi' } as const;

export interface BudgetCardProps {
  budget: BudgetStatusItem;
  /** The category has subcategories, whose spending is counted here too. */
  hasChildren: boolean;
  onEdit: (budget: BudgetStatusItem) => void;
  onDelete: (budget: BudgetStatusItem) => void;
}

export function BudgetCard({ budget, hasChildren, onEdit, onDelete }: BudgetCardProps) {
  const tone = budgetTone(budget.percent);
  // The API stops `remaining` at zero; over the limit the card says by how much.
  const left = BigInt(budget.limitAmount) - BigInt(budget.spent);

  return (
    <article aria-label={budget.category.name} className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <EmojiTile emoji={budget.category.icon} color={budget.category.color} size={44} className="rounded-md text-[21px]" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-semibold leading-[22px]">{budget.category.name}</span>
          <span className="whitespace-nowrap text-[13px] text-text-muted">Limit: {formatAmount(budget.limitAmount)}</span>
        </div>
        <button
          type="button"
          onClick={() => onEdit(budget)}
          aria-label="Tahrirlash"
          title="Tahrirlash"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-secondary hover:text-text focus-ring"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(budget)}
          aria-label="O‘chirish"
          title="O‘chirish"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-danger-soft hover:text-danger focus-ring"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] text-text-secondary">
          Sarflangan <b className="font-semibold text-text">{formatAmountNumber(budget.spent)}</b> · {Math.round(budget.percent)}%
        </span>
        <Chip tone={tone} dot>
          {BUDGET_LABEL[tone]}
        </Chip>
      </div>
      <Progress value={budget.percent} tone={tone} aria-label={`${Math.round(budget.percent)}% sarflandi`} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
        <span className={cn('font-medium', left >= 0n ? 'text-text-secondary' : 'text-danger')}>
          {left >= 0n ? `Qoldiq: ${formatAmount(left)}` : `Limitdan ${formatAmount(-left)} ko‘p sarflandi`}
        </span>
        {hasChildren && (
          <span className="flex items-center gap-1.5 text-text-muted">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Subkategoriyalar ham hisobga olinadi
          </span>
        )}
      </div>
    </article>
  );
}
