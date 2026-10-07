import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shortSom } from '../../lib/money';
import { useReducedMotion } from '../../lib/motion';
import { CHART_ANIMATION_MS, ChartTooltipBox, type RechartsTooltipProps } from './ChartTooltip';

export interface GroupedPoint {
  label: string;
  title: string;
  current: number;
  previous: number;
}

export interface GroupedBarsProps {
  data: GroupedPoint[];
  currentColor: string;
  previousColor?: string;
  height?: number;
  barSize?: number;
  formatValue: (value: number) => string;
  ariaLabel: string;
}

function GroupedTooltip({
  active,
  payload,
  currentColor,
  previousColor,
  formatValue,
}: RechartsTooltipProps<GroupedPoint> & { currentColor: string; previousColor: string; formatValue: (v: number) => string }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <ChartTooltipBox
      title={point.title}
      rows={[
        { label: 'Hozir', value: formatValue(point.current), color: currentColor },
        { label: 'Oldin', value: formatValue(point.previous), color: previousColor },
      ]}
    />
  );
}

/** Current vs previous period side by side per bucket (reports). */
export function GroupedBars({
  data,
  currentColor,
  previousColor = 'var(--input)',
  height = 220,
  barSize = 28,
  formatValue,
  ariaLabel,
}: GroupedBarsProps) {
  const animation = {
    isAnimationActive: !useReducedMotion(),
    animationDuration: CHART_ANIMATION_MS,
    animationEasing: 'ease-out',
  } as const;
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickMargin={8} />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={64}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(value: number) => shortSom(value)}
            tickCount={5}
          />
          <Tooltip
            cursor={{ fill: 'var(--secondary)' }}
            content={(props) => (
              <GroupedTooltip
                {...(props as RechartsTooltipProps<GroupedPoint>)}
                currentColor={currentColor}
                previousColor={previousColor}
                formatValue={formatValue}
              />
            )}
          />
          <Bar dataKey="previous" name="Oldin" fill={previousColor} radius={[6, 6, 0, 0]} barSize={barSize} {...animation} />
          <Bar dataKey="current" name="Hozir" fill={currentColor} radius={[6, 6, 0, 0]} barSize={barSize} {...animation} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
