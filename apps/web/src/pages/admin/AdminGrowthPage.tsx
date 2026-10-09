import { useState } from 'react';
import { AdminStatsGroupBy } from '@fintrack/shared';
import { Segmented } from '../../components/ui/Segmented';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { BarList } from '../../components/charts/BarList';
import { WidgetCard, WidgetState } from '../../features/dashboard/components/WidgetCard';
import { AdminPageHeader } from '../../features/admin/components/AdminShell';
import { GrowthChart, Legend, Stat, seriesOf } from '../../features/admin/components/AdminCharts';
import { RetentionHeatmap } from '../../features/admin/components/RetentionHeatmap';
import { useAdminFunnel, useAdminGrowth, useAdminRetention } from '../../features/admin/hooks/useAdminData';
import { formatCount, percentOf } from '../../features/admin/format';
import { RANGE_LABELS, rangeOf, type AdminRange } from '../../features/admin/periods';

const RANGES: AdminRange[] = ['30d', '90d', '365d'];
const GROUPS: Array<{ value: AdminStatsGroupBy; label: string }> = [
  { value: 'day', label: 'Kun' },
  { value: 'week', label: 'Hafta' },
  { value: 'month', label: 'Oy' },
];

const PEOPLE = seriesOf(['activeUsers', 'newUsers']);
const TOTAL = seriesOf(['registeredUsers']);
const ENTRIES = seriesOf(['entries']);

/** Growth over time, who comes back week after week, and how far new people get. */
export function AdminGrowthPage() {
  const [range, setRange] = useState<AdminRange>('90d');
  const [groupBy, setGroupBy] = useState<AdminStatsGroupBy>('week');
  const period = rangeOf(range);
  const growth = useAdminGrowth(period, groupBy);
  const retention = useAdminRetention(12);
  const funnel = useAdminFunnel(period);
  const points = growth.data?.points ?? [];
  const chart = (series: typeof PEOPLE, label: string) => (
    <WidgetState
      isLoading={growth.isLoading}
      isError={growth.isError}
      onRetry={() => void growth.refetch()}
      skeleton={<Skeleton className="h-[220px] w-full" />}
    >
      <GrowthChart points={points} groupBy={growth.data?.groupBy ?? groupBy} series={series} ariaLabel={label} />
    </WidgetState>
  );

  const f = funnel.data;
  const steps = f
    ? [
        { key: 'registered', label: 'Ro‘yxatdan o‘tdi', value: f.registered },
        { key: 'firstEntry', label: 'Birinchi yozuv', value: f.firstEntry },
        { key: 'fiveEntries', label: '5 va undan ko‘p yozuv', value: f.fiveEntries },
        { key: 'returnedWeek2', label: '2-haftada qaytdi', value: f.returnedWeek2 },
      ]
    : [];

  return (
    <>
      <AdminPageHeader
        title="O‘sish va qaytish"
        actions={
          <>
            <Segmented
              aria-label="Davr"
              size="sm"
              value={range}
              onChange={setRange}
              options={RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
            />
            <Segmented aria-label="Guruhlash" size="sm" value={groupBy} onChange={setGroupBy} options={GROUPS} />
          </>
        }
      />

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <WidgetCard title="Faol va yangi foydalanuvchilar" extra={<Legend series={PEOPLE} />} className="xl:col-span-2">
          {chart(PEOPLE, 'Faol va yangi foydalanuvchilar grafigi')}
        </WidgetCard>
        <WidgetCard title="Jami ro‘yxatdan o‘tganlar" extra={<Legend series={TOTAL} />}>
          {chart(TOTAL, 'Jami ro‘yxatdan o‘tganlar grafigi')}
        </WidgetCard>
        <WidgetCard title="Yozuvlar" extra={<Legend series={ENTRIES} />}>
          {chart(ENTRIES, 'Yozuvlar soni grafigi')}
        </WidgetCard>
      </div>

      <WidgetCard title={`Yangi foydalanuvchilar yo‘li, ${RANGE_LABELS[range]}`}>
        <WidgetState
          isLoading={funnel.isLoading}
          isError={funnel.isError}
          onRetry={() => void funnel.refetch()}
          errorTitle="Ma’lumotni yuklab bo‘lmadi"
          skeleton={<Skeleton className="h-[160px] w-full" />}
        >
          {f && f.registered > 0 ? (
            <div className="flex flex-col gap-4">
              <BarList
                items={steps.map((s, i) => ({
                  key: s.key,
                  label: s.label,
                  value: s.value,
                  color: `var(--chart-${[2, 1, 5, 4][i]})`,
                  display: `${formatCount(s.value)} · ${percentOf(s.value, f.registered)}%`,
                }))}
              />
              <p className="text-[13px] text-text-muted">
                Davrda ro‘yxatdan o‘tganlar. “2-haftada qaytdi” — ro‘yxatdan o‘tgandan keyingi 7–13-kunlarda faol bo‘lganlar.
              </p>
            </div>
          ) : (
            <EmptyState variant="widget" title="Bu davrda hech kim ro‘yxatdan o‘tmagan" className="min-h-[140px]" />
          )}
        </WidgetState>
      </WidgetCard>

      <WidgetCard title="Haftalik qaytish (kogortalar)">
        <WidgetState
          isLoading={retention.isLoading}
          isError={retention.isError}
          onRetry={() => void retention.refetch()}
          errorTitle="Ma’lumotni yuklab bo‘lmadi"
          skeleton={<Skeleton className="h-[360px] w-full" />}
        >
          {retention.data && retention.data.cohorts.some((c) => c.size > 0) ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Kogortalar" value={retention.data.cohorts.length} hint="so‘nggi 12 hafta" />
                <Stat
                  label="Ro‘yxatdan o‘tganlar"
                  value={formatCount(retention.data.cohorts.reduce((sum, c) => sum + c.size, 0))}
                />
              </div>
              <RetentionHeatmap data={retention.data} />
            </div>
          ) : (
            <EmptyState variant="widget" title="So‘nggi 12 haftada ro‘yxatdan o‘tganlar yo‘q" className="min-h-[160px]" />
          )}
        </WidgetState>
      </WidgetCard>
    </>
  );
}
