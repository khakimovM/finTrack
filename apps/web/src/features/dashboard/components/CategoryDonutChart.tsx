import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { CategoryStatsItem, formatMoney } from '@fintrack/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PieChart as PieIcon } from 'lucide-react';

interface CategoryDonutChartProps {
  items?: CategoryStatsItem[];
  total?: string;
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

export function CategoryDonutChart({ items = [], total = '0', isLoading }: CategoryDonutChartProps) {
  const chartData = useMemo(() => {
    return items.map((item, idx) => ({
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
    <Card className="border border-border/60 shadow-sm overflow-hidden flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
          <PieIcon className="h-5 w-5 text-primary" />
          Xarajatlar Taqsimoti
        </CardTitle>
        <CardDescription className="text-xs">
          Kategoriyalar bo‘yicha xarajatlar ulushi
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2 flex-1 flex flex-col justify-center">
        {!hasData ? (
          <div className="py-10">
            <EmptyState
              icon={<PieIcon className="h-10 w-10 text-muted-foreground/60" />}
              title="Xarajatlar mavjud emas"
              description="Ushbu davrda hali birorta kategoriya bo‘yicha xarajat qayd etilmagan"
            />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Pie / Donut container */}
            <div className="w-full md:w-1/2 h-[260px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
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
                            {d.percent.toFixed(1)}% · {d.count} ta tranzaksiya
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Pie
                    data={chartData}
                    dataKey="amountSom"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Total Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Jami Chiqim
                </span>
                <span className="text-sm sm:text-base font-black text-foreground max-w-[120px] truncate">
                  {formatMoney(total, { showFraction: false })}
                </span>
              </div>
            </div>

            {/* Custom Category Legend List */}
            <div className="w-full md:w-1/2 space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {chartData.slice(0, 6).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-foreground truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-semibold text-muted-foreground">
                    <span>{formatMoney(item.amountTiyin, { showFraction: false })}</span>
                    <span className="w-10 text-right font-bold text-foreground">
                      {item.percent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
              {chartData.length > 6 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  + yana {chartData.length - 6} ta kategoriya
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
