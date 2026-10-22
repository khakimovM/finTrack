import type { StatsBalanceTrendResponse, StatsSummaryResponse } from '@fintrack/shared';
import { cn } from '../../../lib/utils';
import { CURRENCY, formatAmountNumber, MINUS, NBSP } from '../../../lib/money';
import { useCountingTiyin } from '../../../lib/motion';
import { CountingAmount } from '../../../components/ui/Amount';
import { ChangeChip } from '../../../components/ui/Chip';
import { KpiCard } from '../../../components/ui/KpiCard';
import { changePercent } from '../periods';

interface KpiGridProps {
  summary?: StatsSummaryResponse;
  trend?: StatsBalanceTrendResponse;
  isLoading: boolean;
  /** What the balance chip and the income and expense chips compare with. */
  vs: { balance: string; flow: string };
  /** New user: plain zeros, no change chips. */
  empty?: boolean;
}

const unit = (
  <>
    {NBSP}
    <span className="text-[14px] font-medium tracking-normal text-text-muted">{CURRENCY}</span>
  </>
);

/** Balance, income, expense and debt balance, each against the previous period. */
export function KpiGrid({ summary, trend, isLoading, vs, empty = false }: KpiGridProps) {
  const grid = 'grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4';
  if (isLoading || !summary) {
    return (
      <div className={grid}>
        {[0, 1, 2, 3].map((i) => (
          <KpiCard key={i} label="" value={null} loading />
        ))}
      </div>
    );
  }

  return <KpiCards summary={summary} trend={trend} vs={vs} empty={empty} className={grid} />;
}

/** The loaded cards; their figures count up when they first show and when the period changes. */
function KpiCards({ summary, trend, vs, empty, className }: Required<Pick<KpiGridProps, 'summary' | 'vs' | 'empty'>> & {
  trend?: StatsBalanceTrendResponse;
  className: string;
}) {
  const income = BigInt(summary.periodIncome);
  const expense = BigInt(summary.periodExpense);
  const net = BigInt(summary.debt.net);
  const shownNet = useCountingTiyin(net);
  const showChanges = !empty;
  // The balance shown is today's, so its chip measures today's against the one the period began with
  // (for a past range too, where the trend's own end would be another day's balance).
  const balanceChange = trend ? changePercent(BigInt(summary.totalBalance), BigInt(trend.meta.startingBalance)) : undefined;

  return (
    <div className={className}>
      <KpiCard
        label="Umumiy balans"
        value={<CountingAmount value={summary.totalBalance} unit="muted" />}
        change={showChanges && balanceChange !== undefined ? <ChangeChip value={balanceChange} upIsGood /> : undefined}
        vsText={showChanges && balanceChange !== undefined ? vs.balance : undefined}
        sub="Barcha hisoblar jami"
      />
      <KpiCard
        label="Kirim"
        value={<CountingAmount value={summary.periodIncome} tone={income === 0n ? 'neutral' : 'income'} unit="muted" />}
        change={showChanges ? <ChangeChip value={changePercent(income, BigInt(summary.previousPeriod.income))} upIsGood /> : undefined}
        vsText={showChanges ? vs.flow : undefined}
      />
      <KpiCard
        label="Chiqim"
        value={<CountingAmount value={summary.periodExpense} tone={expense === 0n ? 'neutral' : 'expense'} unit="muted" />}
        change={
          showChanges ? <ChangeChip value={changePercent(expense, BigInt(summary.previousPeriod.expense))} upIsGood={false} /> : undefined
        }
        vsText={showChanges ? vs.flow : undefined}
      />
      <KpiCard
        label="Qarz saldosi"
        value={
          <span className={cn('whitespace-nowrap font-semibold', net < 0n ? 'text-danger' : net > 0n ? 'text-debt' : 'text-text')}>
            {net > 0n ? '+' : net < 0n ? MINUS : ''}
            {formatAmountNumber(shownNet)}
            {unit}
          </span>
        }
        sub={
          summary.debt.overdueCount > 0
            ? `${summary.debt.overdueCount} ta muddati o‘tgan qarz`
            : 'Berilgan va olingan qarzlar farqi'
        }
        subClassName={summary.debt.overdueCount > 0 ? 'font-medium text-danger' : undefined}
      />
    </div>
  );
}
