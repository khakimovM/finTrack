import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shortSom } from '../../lib/money';
import { useReducedMotion } from '../../lib/motion';
import { CHART_ANIMATION_MS, ChartTooltipBox, type RechartsTooltipProps, type TooltipRow } from './ChartTooltip';

export interface TrendSeries {
  key: string;
  label: string;
  /** CSS colour, e.g. "var(--income)". */
  color: string;
}

export interface TrendPoint {
  /** X-axis label ("1–5", "Du", "Yan"). */
  label: string;
  /** Tooltip heading ("1–5-oktabr"). */
  title: string;
  [series: string]: string | number;
}

export interface AreaTrendProps {
  data: TrendPoint[];
  series: TrendSeries[];
  /** Pixels, or "100%" to fill a sized parent. */
  height?: number | string;
  /** Formats a series value (so‘m) for the tooltip. */
  formatValue: (value: number, series: TrendSeries) => string;
  ariaLabel: string;
}

function TrendTooltip({
  active,
  payload,
  series,
  formatValue,
}: RechartsTooltipProps<TrendPoint> & { series: TrendSeries[]; formatValue: AreaTrendProps['formatValue'] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const rows: TooltipRow[] = series.map((s) => ({
    label: s.label,
    value: formatValue(Number(point[s.key] ?? 0), s),
    color: series.length > 1 ? s.color : undefined,
  }));
  return <ChartTooltipBox title={point.title} rows={rows} minWidth={series.length > 1 ? 190 : 170} />;
}

/** Smoothed area + line per series, dashed horizontal grid, axis values as "1,5 mln". */
export function AreaTrend({ data, series, height = 220, formatValue, ariaLabel }: AreaTrendProps) {
  const animate = !useReducedMotion();
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            interval="preserveStartEnd"
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={64}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(value: number) => shortSom(value)}
            tickCount={5}
          />
          <Tooltip
            cursor={{ stroke: 'var(--input)', strokeWidth: 1 }}
            content={(props) => (
              <TrendTooltip {...(props as RechartsTooltipProps<TrendPoint>)} series={series} formatValue={formatValue} />
            )}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.25}
              fill={s.color}
              fillOpacity={series.length > 1 ? 0.1 : 0.12}
              activeDot={{ r: 5, fill: 'var(--card)', stroke: s.color, strokeWidth: 2.5 }}
              isAnimationActive={animate}
              animationDuration={CHART_ANIMATION_MS}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
