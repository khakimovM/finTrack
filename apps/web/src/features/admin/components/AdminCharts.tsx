import type { ReactNode } from 'react';
import { AdminGrowthPoint, AdminStatsGroupBy } from '@fintrack/shared';
import { AreaTrend, type TrendSeries } from '../../../components/charts/AreaTrend';
import { Donut } from '../../../components/charts/Donut';
import { EmptyState } from '../../../components/ui/EmptyState';
import { bucketLabel, bucketTitle, formatCount, percentOf } from '../format';

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
  const data = points.map((p) => ({
    label: bucketLabel(p.bucket, groupBy),
    title: bucketTitle(p.bucket, groupBy),
    ...Object.fromEntries(series.map((s) => [s.key, p[s.key as keyof AdminGrowthPoint] as number])),
  }));
  return (
    <div style={{ height }}>
      <AreaTrend ariaLabel={ariaLabel} data={data} series={series} height="100%" formatValue={(value) => formatCount(value)} />
    </div>
  );
}

export interface ShareItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** A donut with its legend: label, count and share of the total. */
export function ShareDonut({ items, total, centerLabel, ariaLabel }: { items: ShareItem[]; total: number; centerLabel: string; ariaLabel: string }) {
  const shown = items.filter((i) => i.value > 0);
  if (shown.length === 0) {
    return <EmptyState variant="widget" title="Hali ma’lumot yo‘q" className="min-h-[156px]" />;
  }
  const sum = shown.reduce((acc, i) => acc + i.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <Donut
        ariaLabel={ariaLabel}
        data={shown.map((i) => ({ name: i.label, value: i.value, color: i.color, detail: `${percentOf(i.value, sum)}%` }))}
        center={
          <>
            <span className="text-[12px] text-text-muted">{centerLabel}</span>
            <span className="text-[20px] font-semibold leading-7">{formatCount(total)}</span>
          </>
        }
      />
      <ul className="flex w-full min-w-0 flex-col gap-2.5">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-2.5 text-[14px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: i.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-text-secondary">{i.label}</span>
            <span className="font-semibold tabular-nums">{formatCount(i.value)}</span>
            <span className="w-11 text-right text-[13px] text-text-muted tabular-nums">{percentOf(i.value, sum)}%</span>
          </li>
        ))}
      </ul>
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
