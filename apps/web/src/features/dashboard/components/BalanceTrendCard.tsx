import { todayLocalIso } from '@fintrack/shared';
import { formatDayMonth, formatShortDate } from '../../../lib/format';
import { usePeriodStore } from '../../../stores/periodStore';
import { formatAmount, tiyinToChartNumber } from '../../../lib/money';
import { AreaTrend } from '../../../components/charts/AreaTrend';
import { Amount } from '../../../components/ui/Amount';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useStatsBalanceTrend } from '../hooks/useDashboard';
import { WidgetCard, WidgetState } from './WidgetCard';
import { t } from '../../../lib/i18n';

/** Running total of all accounts over the period, with where it started and ended. */
export function BalanceTrendCard() {
  const query = useStatsBalanceTrend();
  const data = query.data;
  // A running period's line stops today (useStatsBalanceTrend), so its last figure is today's balance.
  const { from, to } = usePeriodStore();
  const today = todayLocalIso();
  const running = from <= today && today < to;
  // The line starts from the balance before the period ("Boshi"), so even a single day draws a line.
  const points = data
    ? [
        { label: t('dashboard.balanceTrend.start'), title: t('dashboard.balanceTrend.startTitle'), balance: tiyinToChartNumber(data.meta.startingBalance) },
        ...data.data.map((item) => ({
          label: formatShortDate(item.date),
          title: formatDayMonth(item.date),
          balance: tiyinToChartNumber(item.balance),
        })),
      ]
    : [];

  const stat = (label: string, value: string) => (
    <span className="flex flex-col">
      <span className="text-[12px] text-text-muted">{label}</span>
      <Amount value={value} className="text-[14px]" />
    </span>
  );

  return (
    <WidgetCard
      title={t('dashboard.balanceTrend.title')}
      extra={
        data ? (
          <div className="flex gap-5">
            {stat(t('dashboard.balanceTrend.opening'), data.meta.startingBalance)}
            {stat(running ? t('common.today') : t('dashboard.balanceTrend.closing'), data.meta.endingBalance)}
          </div>
        ) : undefined
      }
    >
      <WidgetState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        skeleton={<Skeleton className="h-[180px] w-full sm:h-[220px]" />}
      >
        {points.length === 0 ? (
          <EmptyState variant="widget" title={t('dashboard.balanceTrend.empty')} description={t('dashboard.balanceTrend.emptyText')} />
        ) : (
          <div className="h-[180px] sm:h-[220px]">
            <AreaTrend
              ariaLabel={t('dashboard.balanceTrend.chart')}
              data={points}
              series={[{ key: 'balance', label: t('dashboard.balanceTrend.series'), color: 'var(--chart-2)' }]}
              height="100%"
              formatValue={(value) => formatAmount(BigInt(Math.round(value)) * 100n, { sign: 'negative' })}
            />
          </div>
        )}
      </WidgetState>
    </WidgetCard>
  );
}
