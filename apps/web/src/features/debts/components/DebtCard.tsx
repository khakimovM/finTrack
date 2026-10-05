import { forwardRef } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, EllipsisVertical, HandCoins, Pencil, Trash2 } from 'lucide-react';
import type { DebtPaymentResponse, DebtResponse } from '@fintrack/shared';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { Menu } from '../../../components/ui/Menu';
import { Progress } from '../../../components/ui/Progress';
import { formatDate } from '../../../lib/format';
import { formatAmount, formatAmountNumber } from '../../../lib/money';
import { cn } from '../../../lib/utils';
import { useDebtPayments } from '../hooks/useDebts';
import { DEBT_STATUS, dueChip, dueText, paidPercent } from '../debtView';

export interface DebtCardActions {
  onPay: (debt: DebtResponse) => void;
  onSettle: (debt: DebtResponse) => void;
  onEdit: (debt: DebtResponse) => void;
  onDelete: (debt: DebtResponse) => void;
  onDeletePayment: (debt: DebtResponse, payment: DebtPaymentResponse) => void;
}

export interface DebtCardProps {
  debt: DebtResponse;
  actions: DebtCardActions;
  historyOpen: boolean;
  onToggleHistory: () => void;
  /** Reached through "Qarzga o‘tish": ringed. */
  focused?: boolean;
}

function Stat({ label, value, end, className }: { label: string; value: string; end?: boolean; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', end && 'items-end text-right')}>
      <span className="text-[12px] text-text-muted">{label}</span>
      <span className={cn('whitespace-nowrap text-[14px] font-semibold tabular-nums sm:text-[15px]', className)}>{value}</span>
    </div>
  );
}

function History({ debt, onDelete }: { debt: DebtResponse; onDelete: (payment: DebtPaymentResponse) => void }) {
  const payments = useDebtPayments(debt.id);
  if (payments.isLoading) return <span className="py-2.5 text-[13px] text-text-muted">Yuklanmoqda…</span>;
  if (payments.isError) return <span className="py-2.5 text-[13px] text-danger">To‘lovlarni yuklab bo‘lmadi</span>;
  const list = payments.data ?? [];
  if (list.length === 0) return <span className="py-2.5 text-[13px] text-text-muted">Hali to‘lov yo‘q</span>;
  return (
    <ul className="-mt-1.5 flex flex-col" aria-label="To‘lovlar tarixi">
      {list.map((payment) => (
        <li key={payment.id} className="flex min-h-[52px] items-center gap-2.5 border-b border-border last:border-b-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-debt-soft text-debt" aria-hidden>
            <HandCoins className="h-4 w-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13.5px] font-medium">{payment.note || 'To‘lov'}</span>
            <span className="truncate text-[12px] text-text-muted">
              {formatDate(payment.paidAt)} · {payment.account.name}
            </span>
          </div>
          <span className="whitespace-nowrap text-[14px] font-semibold text-debt">{formatAmount(payment.amount)}</span>
          <button
            type="button"
            onClick={() => onDelete(payment)}
            aria-label="To‘lovni o‘chirish"
            title="To‘lovni o‘chirish"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-danger-soft hover:text-danger focus-ring"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export const DebtCard = forwardRef<HTMLElement, DebtCardProps>(function DebtCard(
  { debt, actions, historyOpen, onToggleHistory, focused },
  ref,
) {
  const lent = debt.direction === 'I_LENT';
  const paid = debt.status === 'PAID';
  const status = DEBT_STATUS[debt.status];
  const chip = dueChip(debt);
  const percent = paidPercent(debt);
  const remaining = BigInt(debt.remainingAmount);
  const payments = useDebtPayments(debt.id, { enabled: historyOpen });
  const Chevron = historyOpen ? ChevronUp : ChevronDown;

  return (
    <article
      ref={ref}
      aria-label={debt.personName}
      className={cn(
        'flex flex-col gap-3.5 rounded-[20px] border bg-card p-4 sm:p-5',
        focused
          ? 'border-ring shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]'
          : debt.isOverdue
            ? 'border-[color-mix(in_oklab,var(--danger)_40%,var(--border))]'
            : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={debt.personName} size={44} letters={2} tone={lent ? 'debt' : 'neutral'} className="text-[15px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[16px] font-semibold leading-[22px]">{debt.personName}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-text-muted">
            <span className={cn('whitespace-nowrap font-medium', lent ? 'text-debt' : 'text-text-secondary')}>{lent ? 'Menga qarzdor' : 'Men qarzdorman'}</span>
            {debt.personPhone && (
              <>
                <span aria-hidden>·</span>
                <a href={`tel:${debt.personPhone.replace(/\s/g, '')}`} className="whitespace-nowrap text-text-secondary hover:text-text hover:underline">
                  {debt.personPhone}
                </a>
              </>
            )}
          </span>
        </div>
        <Chip tone={status.tone} dot>
          {status.label}
        </Chip>
        <Menu
          label="Amallar"
          width={200}
          className="-mr-2 -mt-[5px]"
          items={[
            { label: 'Tahrirlash', icon: Pencil, onSelect: () => actions.onEdit(debt) },
            { label: 'O‘chirish', icon: Trash2, danger: true, separatorBefore: true, onSelect: () => actions.onDelete(debt) },
          ]}
          trigger={(props) => (
            <button
              {...props}
              type="button"
              aria-label="Amallar"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-text-secondary hover:bg-secondary focus-ring aria-expanded:bg-secondary"
            >
              <EllipsisVertical className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Asl summa" value={formatAmountNumber(debt.amount)} />
        <Stat label={`To‘langan · ${percent}%`} value={formatAmountNumber(debt.paidAmount)} />
        <Stat
          label="Qoldiq, so‘m"
          value={formatAmountNumber(debt.remainingAmount)}
          end
          className={remaining === 0n ? 'text-success' : debt.isOverdue ? 'text-danger' : undefined}
        />
      </div>
      <Progress value={percent} tone={paid ? 'success' : 'debt'} aria-label={`${percent}% to‘langan`} />

      <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
        <CalendarDays className="h-4 w-4" aria-hidden />
        <span>{dueText(debt)}</span>
        {chip && (
          <Chip tone={chip.tone} className="font-semibold">
            {chip.label}
          </Chip>
        )}
      </div>

      {debt.note && <p className="rounded-md bg-surface px-3 py-2.5 text-[13.5px] leading-[19px] text-text-secondary">{debt.note}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {!paid && (
          <>
            <Button size="sm" onClick={() => actions.onPay(debt)}>
              To‘lov kiritish
            </Button>
            <Button size="sm" variant="outline" onClick={() => actions.onSettle(debt)}>
              To‘liq yopish
            </Button>
          </>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onToggleHistory}
          aria-expanded={historyOpen}
          className="flex h-9 items-center gap-1 whitespace-nowrap rounded-full pl-2.5 pr-1.5 text-[13px] font-medium text-text-secondary hover:bg-secondary hover:text-text focus-ring"
        >
          To‘lovlar tarixi{payments.data ? ` (${payments.data.length})` : ''}
          <Chevron className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {historyOpen && <History debt={debt} onDelete={(payment) => actions.onDeletePayment(debt, payment)} />}
    </article>
  );
});
