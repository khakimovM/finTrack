import { Pause, Pencil, Play, Repeat, Trash2 } from 'lucide-react';
import type { RecurringRuleResponse } from '@fintrack/shared';
import { Amount } from '../../../components/ui/Amount';
import { EmojiTile } from '../../../components/ui/EmojiTile';
import { formatDate } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { ruleTitle, scheduleLabel } from '../recurringLabels';

export interface RecurringRuleCardProps {
  rule: RecurringRuleResponse;
  onRunNow: (rule: RecurringRuleResponse) => void;
  onToggleActive: (rule: RecurringRuleResponse) => void;
  onEdit: (rule: RecurringRuleResponse) => void;
  onDelete: (rule: RecurringRuleResponse) => void;
  busy?: boolean;
}

const iconButton = 'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-text-secondary focus-ring';

export function RecurringRuleCard({ rule, onRunNow, onToggleActive, onEdit, onDelete, busy }: RecurringRuleCardProps) {
  // The note is the title when there is no category; otherwise it is shown under the details.
  const note = rule.category ? rule.note : null;
  const finished = rule.endsAt !== null && rule.nextRunAt > rule.endsAt;
  const next = !rule.isActive ? 'To‘xtatilgan' : finished ? 'Tugagan' : `Keyingi: ${formatDate(rule.nextRunAt)}`;

  return (
    <article
      aria-label={ruleTitle(rule)}
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[20px] border border-border bg-card p-4 sm:px-5',
        !rule.isActive && 'opacity-80',
      )}
    >
      <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
        <EmojiTile
          emoji={rule.category?.icon ?? (rule.type === 'INCOME' ? '💰' : '🧾')}
          color={rule.category?.color}
          variant={rule.category ? 'color' : 'neutral'}
          size={44}
          muted={!rule.isActive}
          className="rounded-md text-[21px]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-baseline gap-2.5">
            <h3 className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-[22px]">{ruleTitle(rule)}</h3>
            <Amount value={rule.amount} type={rule.type} className="text-[15px]" />
          </div>
          <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-text-secondary">
            <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {scheduleLabel(rule)}
          </span>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] leading-[17px] text-text-muted">
            <span>
              {rule.account.icon} {rule.account.name}
            </span>
            <span className={cn('font-medium', rule.isActive ? 'text-text' : 'text-warning')}>{next}</span>
            {rule.endsAt && <span>{formatDate(rule.endsAt)} gacha</span>}
          </div>
          {note && <span className="text-[13px] text-text-secondary">{note}</span>}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-1 sm:flex-none">
        {rule.isActive && !finished && (
          <button
            type="button"
            onClick={() => onRunNow(rule)}
            disabled={busy}
            className="h-[34px] whitespace-nowrap rounded-full border border-input px-3 text-[13px] font-medium text-text hover:bg-secondary focus-ring disabled:opacity-50"
          >
            Hozir bajarish
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggleActive(rule)}
          disabled={busy}
          className="flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary px-3 text-[13px] font-medium text-text hover:bg-secondary-hover focus-ring disabled:opacity-50"
        >
          {rule.isActive ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {rule.isActive ? 'To‘xtatish' : 'Davom ettirish'}
        </button>
        <span className="flex-1 sm:hidden" />
        <button type="button" onClick={() => onEdit(rule)} aria-label="Tahrirlash" title="Tahrirlash" className={cn(iconButton, 'hover:bg-secondary hover:text-text')}>
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => onDelete(rule)} aria-label="O‘chirish" title="O‘chirish" className={cn(iconButton, 'hover:bg-danger-soft hover:text-danger')}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}
