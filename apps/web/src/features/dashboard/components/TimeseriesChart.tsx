import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { StatsTimeseriesItem, formatMoney } from '@fintrack/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface TimeseriesChartProps {
  data?: StatsTimeseriesItem[];
  isLoading?: boolean;
}

export function TimeseriesChart({ data = [], isLoading }: TimeseriesChartProps) {
  // Format data for Recharts (son qiymatlari grafikka beriladi, tooltipda esa tiyin string formatlanadi)
  const chartData = useMemo(() => {
    return data.map((d) => ({
      bucket: d.bucket,
      // Recharts y-axis uchun so'mga o'giramiz (BigInt tiyin / 100)
      incomeSom: Number(BigInt(d.income) / 100n),
      expenseSom: Number(BigInt(d.expense) / 100n),
      incomeTiyin: d.income,
      expenseTiyin: d.expense,
      netTiyin: d.net,
    }));
  }, [data]);

  // Hamma qiymat nolmi yoki yo'qligini tekshirish
  const hasData = useMemo(() => {
    return chartData.some((d) => d.incomeSom > 0 || d.expenseSom > 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Kirim va Chiqim Dinamikasi
            </CardTitle>
            <CardDescription className="text-xs">
              Tanlangan davrdagi moliyaviy oqimlar taqqoslanishi
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {!hasData ? (
          <div className="py-12">
            <EmptyState
              icon={<BarChart3 className="h-10 w-10 text-muted-foreground/60" />}
              title="Ushbu davrda ma’lumot yo‘q"
              description="Tanlangan davr oralig‘ida kirim yoki chiqim tranzaksiyalari amalga oshirilmagan"
            />
          </div>
        ) : (
          <div className="w-full h-[320px] min-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="bucket"
                  tickLine={false}
                  axisLine={false}
                  className="text-[11px] fill-muted-foreground"
                  tickFormatter={(val: string) => {
                    // YYYY-MM-DD -> MM-DD yoki YYYY-MM
                    const parts = val.split('-');
                    if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
                    if (parts.length === 2) return `${parts[1]}.${parts[0]}`;
                    return val;
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  className="text-[11px] fill-muted-foreground"
                  tickFormatter={(val: number) => {
                    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} mln`;
                    if (val >= 1_000) return `${(val / 1_000).toFixed(0)} ming`;
                    return `${val}`;
                  }}
                  width={68}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0]?.payload;
                    if (!item) return null;

                    return (
                      <div className="rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[170px]">
                        <p className="font-bold text-muted-foreground border-b border-border/50 pb-1">
                          {label}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-success font-semibold">
                            <span className="h-2 w-2 rounded-full bg-success" /> Kirim:
                          </span>
                          <span className="font-bold">{formatMoney(item.incomeTiyin)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-destructive font-semibold">
                            <span className="h-2 w-2 rounded-full bg-destructive" /> Chiqim:
                          </span>
                          <span className="font-bold">{formatMoney(item.expenseTiyin)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  formatter={(value) => (value === 'incomeSom' ? 'Kirim' : 'Chiqim')}
                />
                <Area
                  type="monotone"
                  dataKey="incomeSom"
                  name="incomeSom"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#incomeGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="expenseSom"
                  name="expenseSom"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
