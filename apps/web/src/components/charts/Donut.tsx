import * as React from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { ChartTooltipBox, type RechartsTooltipProps } from './ChartTooltip';

export interface DonutSlice {
  name: string;
  value: number;
  /** CSS colour (category token). */
  color: string;
  /** Tooltip line under the name ("38% · 12 ta tranzaksiya"). */
  detail?: string;
}

export interface DonutProps {
  data: DonutSlice[];
  size?: number;
  /** Text in the hole ("Jami chiqim" / "6,4 mln" / "so‘m"). */
  center?: React.ReactNode;
  ariaLabel: string;
}

function DonutTooltip({ active, payload }: RechartsTooltipProps<DonutSlice>) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return <ChartTooltipBox title={slice.name} rows={[{ label: slice.detail ?? '', value: '', color: slice.color }]} minWidth={150} />;
}

/** Expense share by category: ring at 72% inner radius with 1° gaps. Debts and transfers never go in. */
export function Donut({ data, size = 156, center, ariaLabel }: DonutProps) {
  return (
    <div role="img" aria-label={ariaLabel} className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="72%"
          outerRadius="100%"
          paddingAngle={1}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={false}
        >
          {data.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip content={(props) => <DonutTooltip {...(props as RechartsTooltipProps<DonutSlice>)} />} />
      </PieChart>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      )}
    </div>
  );
}
