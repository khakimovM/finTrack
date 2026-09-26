import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { CategoryStatsItem, formatMoney } from '@fintrack/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { BarChart2 } from 'lucide-react';

interface CategoryBarChartProps {
  items?: CategoryStatsItem[];
  isLoading?: boolean;
}

const DEFAULT_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
];

export function CategoryBarChart({ items = [], isLoading }: CategoryBarChartProps) {
  const chartData = useMemo(() => {
    return items.slice(0, 8).map((item, idx) => ({
      name: item.name,
      amountTiyin: item.amount,
      amountSom: Number(BigInt(item.amount) / 100n),
      percent: item.percent,
      color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      count: item.count,
    }));
  }, [items]);

  const hasData = chartData.length > 0 && chartData.some((d) => d.amountSom > 0);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          Kategoriyalarni Taqqoslash
        </CardTitle>
        <CardDescription className="text-xs">
          Eng ko‘p sarf-xarajat qilingan asosiy yo‘nalishlar
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4">
        {!hasData ? (
          <div className="py-12">
            <EmptyState
              icon={<BarChart2 className="h-10 w-10 text-muted-foreground/60" />}
              title="Kategoriyalar bo‘yicha xarajat yo‘q"
              description="Tanlangan davrda birorta ham kategoriya uchun mablag‘ sarflanmagan"
            />
          </div>
        ) : (
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  className="text-[11px] fill-muted-foreground"
                  interval={0}
                  tick={({ x, y, payload }) => {
                    const label = payload.value.length > 10 ? `${payload.value.slice(0, 10)}…` : payload.value;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={14}
                          textAnchor="middle"
                          fill="currentColor"
                          className="text-[11px] fill-muted-foreground font-medium"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  className="text-[11px] fill-muted-foreground"
                  tickFormatter={(val: number) => {
                    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
                    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                  width={58}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-md text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="font-bold">{d.name}</span>
                        </div>
                        <div className="font-extrabold text-foreground pt-1">
                          {formatMoney(d.amountTiyin)}
                        </div>
                        <div className="text-muted-foreground">
                          Jami chiqimdan {d.percent.toFixed(1)}% · {d.count} ta to‘lov
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amountSom" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
