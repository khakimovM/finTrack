import { todayLocalIso } from '@fintrack/shared';
import { usePeriodStore } from '../../../stores/periodStore';
import { formatAmount } from '../../../lib/money';
import { AreaTrend, type TrendSeries } from '../../../components/charts/AreaTrend';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useTransactions } from '../../transactions/hooks/useTransactions';
import { useStatsTimeseries } from '../hooks/useDashboard';
import { flowPoints, hourlyPoints, isFlat } from '../periods';
import { WidgetCard, WidgetState } from './WidgetCard';

const SERIES: TrendSeries[] = [
  { key: 'income', label: 'Kirim', color: 'var(--income)' },
  { key: 'expense', label: 'Chiqim', color: 'var(--expense)' },
];

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[13px] text-text-secondary">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** "Kirim va chiqim dinamikasi": API buckets for the period, today by recording hour. */
export function FlowChartCard() {
  const { preset, from, to, groupBy } = usePeriodStore();
  const today = todayLocalIso();
  const isToday = preset === 'today';
  const series = useStatsTimeseries();
  // Today has no hourly bucket in the API; the day's entries are few enough to group here.
  const todays = useTransactions({ from: today, to: today, limit: 100 }, { enabled: isToday });
  const query = isToday ? todays : series;

  const points = isToday
    ? hourlyPoints(todays.data?.data ?? [], today)
    : flowPoints(series.data?.data ?? [], groupBy, { from, to, preset }, today);

  return (
    <WidgetCard title="Kirim va chiqim dinamikasi" extra={<Legend />} className="xl:col-span-7">
      <WidgetState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        skeleton={<Skeleton className="h-[180px] w-full sm:h-[220px]" />}
      >
        {isFlat(points, ['income', 'expense']) ? (
          <EmptyState
            variant="widget"
            title="Ushbu davrda maʼlumot yo‘q"
            description="Boshqa davrni tanlang yoki tranzaksiya qo‘shing."
            className="min-h-[220px]"
          />
        ) : (
          <div className="h-[180px] sm:h-[220px]">
            <AreaTrend
              ariaLabel="Kirim va chiqim dinamikasi grafigi"
              data={points}
              series={SERIES}
              height="100%"
              formatValue={(value, s) => formatAmount(BigInt(Math.round(value)) * 100n, { sign: s.key === 'income' ? '+' : '-' })}
            />
          </div>
        )}
      </WidgetState>
    </WidgetCard>
  );
}
