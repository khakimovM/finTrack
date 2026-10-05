import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { StatsSummaryResponse } from '@fintrack/shared';
import { cn } from '../../../lib/utils';
import { formatPercent } from '../../../lib/format';
import { formatAmountNumber, NBSP } from '../../../lib/money';
import { Progress } from '../../../components/ui/Progress';
import { Skeleton } from '../../../components/ui/Skeleton';

/** Expense as a share of income, in one decimal (basis points keep it off floats). */
export function expenseRatio(income: bigint, expense: bigint): number | null {
  if (income <= 0n) return null;
  return Number((expense * 1000n) / income) / 10;
}

const ZONES = {
  good: { colour: 'text-success', tone: 'success', icon: CircleCheck },
  warn: { colour: 'text-warning', tone: 'warning', icon: TriangleAlert },
  over: { colour: 'text-danger', tone: 'danger', icon: TriangleAlert },
} as const;

/** "Kirimga nisbatan xarajat": green to 70%, amber to 100%, red beyond, with a 70% tick. */
export function ExpenseRatioCard({ summary, isLoading }: { summary?: StatsSummaryResponse; isLoading: boolean }) {
  if (isLoading || !summary) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:px-6 sm:py-5">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-2.5 w-full rounded-full" />
        <Skeleton className="h-4 w-1/2" />
      </section>
    );
  }

  const income = BigInt(summary.periodIncome);
  const expense = BigInt(summary.periodExpense);
  const ratio = expenseRatio(income, expense);
  const zone = ratio === null ? null : ratio <= 70 ? ZONES.good : ratio <= 100 ? ZONES.warn : ZONES.over;
  const Icon = zone ? zone.icon : Info;
  const message =
    ratio === null
      ? 'Bu davrda kirim yozilmagan.'
      : ratio <= 70
        ? 'Ajoyib! Xarajatlaringiz meʼyorida.'
        : ratio <= 100
          ? 'Xarajatlaringiz daromadingizning 70% idan oshdi.'
          : `Bu davrda daromadingizdan ${formatPercent(ratio - 100)} ko‘p sarfladingiz!`;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold leading-6">Kirimga nisbatan xarajat</h2>
        <span className={cn('text-[24px] font-semibold leading-[30px]', zone ? zone.colour : 'text-text-muted')}>
          {ratio === null ? '—' : formatPercent(ratio)}
        </span>
      </div>
      <div className="pb-3">
        <Progress
          value={ratio ?? 0}
          tone={zone ? zone.tone : 'neutral'}
          size="lg"
          marker={70}
          aria-label="Kirimga nisbatan xarajat"
        />
        <span className="relative block h-0" aria-hidden>
          <span className="absolute top-1 -translate-x-1/2 text-[11px] text-text-muted" style={{ left: '70%' }}>
            70%
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className={cn('flex items-center gap-2 text-[14px] font-medium leading-5', zone ? zone.colour : 'text-text-muted')}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {message}
        </p>
        <span className="text-[13px] text-text-muted">
          {formatAmountNumber(expense)} / {formatAmountNumber(income)}
          {NBSP}so‘m
        </span>
      </div>
    </section>
  );
}
