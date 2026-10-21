import type { ReactNode } from 'react';
import { AdminGrowthPoint, AdminStatsGroupBy, AdminUsageResponse } from '@fintrack/shared';
import { AreaTrend, type TrendSeries } from '../../../components/charts/AreaTrend';
import { BarList } from '../../../components/charts/BarList';
import { EmptyState } from '../../../components/ui/EmptyState';
import { bucketLabel, bucketTitle, formatCount, percentOf } from '../format';
import { CHANNELS } from '../labels';
import { adminToday, bucketInProgress } from '../periods';

/** Colours of the panel's series, the same on every page. */
export const SERIES_COLORS = {
  newUsers: 'var(--chart-2)',
  activeUsers: 'var(--chart-1)',
  registeredUsers: 'var(--chart-4)',
  entries: 'var(--chart-3)',
} as const;

export const SERIES_LABELS: Record<keyof typeof SERIES_COLORS, string> = {
  newUsers: 'Yangi',
  activeUsers: 'Faol',
  registeredUsers: 'Jami ro‘yxatda',
  entries: 'Yozuvlar',
};

export function Legend({ series }: { series: TrendSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-text-secondary">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function seriesOf(keys: Array<keyof typeof SERIES_COLORS>): TrendSeries[] {
  return keys.map((key) => ({ key, label: SERIES_LABELS[key], color: SERIES_COLORS[key] }));
}

/** Growth points as a chart: one series per chosen key, zero-filled buckets included. */
export function GrowthChart({
  points,
  groupBy,
  series,
  ariaLabel,
  height = 220,
}: {
  points: AdminGrowthPoint[];
  groupBy: AdminStatsGroupBy;
  series: TrendSeries[];
  ariaLabel: string;
  height?: number;
}) {
  const flat = points.every((p) => series.every((s) => (p[s.key as keyof AdminGrowthPoint] as number) === 0));
  if (points.length === 0 || flat) {
    return (
      <EmptyState
        variant="widget"
        title="Bu davrda hali hech narsa yo‘q"
        description="Boshqa davrni tanlang."
        className="min-h-[180px]"
      />
    );
  }
  const today = adminToday();
  const data = points.map((p) => ({
    label: bucketLabel(p.bucket, groupBy),
    // The last bucket is still filling up: its lower count is not a drop.
    title: `${bucketTitle(p.bucket, groupBy)}${bucketInProgress(p.bucket, groupBy, today) ? ' · davom etmoqda' : ''}`,
    ...Object.fromEntries(series.map((s) => [s.key, p[s.key as keyof AdminGrowthPoint] as number])),
  }));
  return (
    <div style={{ height }}>
      <AreaTrend ariaLabel={ariaLabel} data={data} series={series} height="100%" formatValue={(value) => formatCount(value)} />
    </div>
  );
}

/**
 * Active users per channel as shares of everyone active. One person often uses several channels,
 * so the shares add up to more than 100%: parts of a whole (a donut) would misstate them.
 */
export function ChannelBars({ active }: { active: AdminUsageResponse['activeUsers'] }) {
  if (active.total === 0) {
    return <EmptyState variant="widget" title="Bu davrda faol foydalanuvchi yo‘q" className="min-h-[156px]" />;
  }
  return (
    <div className="flex flex-col gap-3">
      <BarList
        max={active.total}
        items={CHANNELS.map((c) => ({
          key: c.key,
          label: c.label,
          value: active[c.key],
          color: c.color,
          display: `${formatCount(active[c.key])} · ${percentOf(active[c.key], active.total)}%`,
        }))}
      />
      <p className="text-[13px] text-text-muted">
        {formatCount(active.total)} faol foydalanuvchidan. Bir kishi bir nechta kanaldan foydalanishi mumkin, shuning uchun foizlar
        yig‘indisi 100% dan oshishi mumkin.
      </p>
    </div>
  );
}

/** A labelled number inside a card ("Bloklangan 3"). */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-[13px] text-text-secondary">{label}</span>
      <span className="text-[20px] font-semibold leading-7 tabular-nums">{value}</span>
      {hint && <span className="text-[12px] text-text-muted">{hint}</span>}
    </div>
  );
}
