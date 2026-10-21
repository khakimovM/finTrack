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
import { RANGE_LABELS, rangeOf, shiftDay, wholeBuckets, type AdminRange } from '../../features/admin/periods';

const RANGES: AdminRange[] = ['30d', '90d', '365d'];
const GROUPS: Array<{ value: AdminStatsGroupBy; label: string }> = [
  { value: 'day', label: 'Kun' },
  { value: 'week', label: 'Hafta' },
  { value: 'month', label: 'Oy' },
];

const PEOPLE = seriesOf(['activeUsers', 'newUsers']);
const TOTAL = seriesOf(['registeredUsers']);
const ENTRIES = seriesOf(['entries']);

/** Days 7–13 after signing up are the second week: only after day 13 is "came back" settled. */
const WEEK2_SETTLED_DAYS = 14;

/** Growth over time, who comes back week after week, and how far new people get. */
export function AdminGrowthPage() {
  const [range, setRange] = useState<AdminRange>('90d');
  const [groupBy, setGroupBy] = useState<AdminStatsGroupBy>('week');
  const period = rangeOf(range);
  const growth = useAdminGrowth(wholeBuckets(period, groupBy), groupBy);
  const retention = useAdminRetention(12);
  const funnel = useAdminFunnel(period);
  // Whoever signed up in the last two weeks cannot have come back in their second week yet;
  // counting them would pull the share down for no reason, so that step has its own base.
  const settled = useAdminFunnel({ from: period.from, to: shiftDay(period.to, -WEEK2_SETTLED_DAYS) });
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
  const s = settled.data;
  const steps = f
    ? [
        { key: 'registered', label: 'Ro‘yxatdan o‘tdi', value: f.registered },
        { key: 'firstEntry', label: 'Birinchi yozuv', value: f.firstEntry },
        { key: 'fiveEntries', label: '5 va undan ko‘p yozuv', value: f.fiveEntries },
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
          isLoading={funnel.isLoading || settled.isLoading}
          isError={funnel.isError || settled.isError}
          onRetry={() => {
            void funnel.refetch();
            void settled.refetch();
          }}
          errorTitle="Ma’lumotni yuklab bo‘lmadi"
          skeleton={<Skeleton className="h-[160px] w-full" />}
        >
          {f && f.registered > 0 ? (
            <div className="flex flex-col gap-3">
              <BarList
                max={f.registered}
                items={steps.map((step, i) => ({
                  key: step.key,
                  label: step.label,
                  value: step.value,
                  color: `var(--chart-${[2, 1, 5][i]})`,
                  display: `${formatCount(step.value)} · ${percentOf(step.value, f.registered)}%`,
                }))}
              />
              {s && s.registered > 0 ? (
                <BarList
                  max={s.registered}
                  items={[
                    {
                      key: 'returnedWeek2',
                      label: '2-haftada qaytdi',
                      value: s.returnedWeek2,
                      color: 'var(--chart-4)',
                      display: `${formatCount(s.returnedWeek2)} · ${percentOf(s.returnedWeek2, s.registered)}%`,
                    },
                  ]}
                />
              ) : (
                <p className="text-[14px] text-text-secondary">2-haftada qaytganlar: hali erta — davrda ro‘yxatdan o‘tganlarning hech biriga 14 kun to‘lmagan.</p>
              )}
              <p className="text-[13px] text-text-muted">
                Davrda ro‘yxatdan o‘tganlar. “2-haftada qaytdi” — ro‘yxatdan o‘tgandan keyingi 7–13-kunlarda yana faol bo‘lganlar; u
                faqat 14 kuni to‘lganlar orasida hisoblanadi{s && s.registered > 0 ? ` (${formatCount(s.registered)} kishi)` : ''}, chunki
                yangiroqlarning ikkinchi haftasi hali tugamagan.
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
