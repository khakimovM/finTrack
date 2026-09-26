import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { StatsBalanceTrendResponse, formatMoney } from '@fintrack/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Amount } from '../../../components/ui/Amount';
import { Activity } from 'lucide-react';

interface BalanceTrendChartProps {
  trendData?: StatsBalanceTrendResponse;
  isLoading?: boolean;
}

export function BalanceTrendChart({ trendData, isLoading }: BalanceTrendChartProps) {
  const data = trendData?.data ?? [];
  const meta = trendData?.meta;

  const chartData = useMemo(() => {
    return data.map((d) => ({
      date: d.date,
      balanceSom: Number(BigInt(d.balance) / 100n),
      balanceTiyin: d.balance,
      changeTiyin: d.change,
    }));
  }, [data]);

  const hasData = chartData.length > 0;

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Balans Dinamikasi
            </CardTitle>
            <CardDescription className="text-xs">
              Mablag‘larning kunlik kumulyativ o‘zgarish trendi
            </CardDescription>
          </div>

          {meta && (
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Boshlang‘ich: </span>
                <span className="font-bold">
                  <Amount value={meta.startingBalance} showSign={false} />
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Yakuniy: </span>
                <span className="font-bold">
                  <Amount value={meta.endingBalance} showSign={false} />
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {!hasData ? (
          <div className="py-12">
            <EmptyState
              icon={<Activity className="h-10 w-10 text-muted-foreground/60" />}
              title="Balans ma’lumotlari yo‘q"
              description="Ushbu davr oralig‘ida balans dinamikasi mavjud emas"
            />
          </div>
        ) : (
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  className="text-[11px] fill-muted-foreground"
                  tickFormatter={(val: string) => {
                    const parts = val.split('-');
                    return parts.length === 3 ? `${parts[2]}.${parts[1]}` : val;
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  className="text-[11px] fill-muted-foreground"
                  tickFormatter={(val: number) => {
                    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
                    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                  width={68}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;

                    return (
                      <div className="rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[170px]">
                        <p className="font-bold text-muted-foreground border-b border-border/50 pb-1">
                          {label}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Balans:</span>
                          <span className="font-extrabold text-primary">
                            {formatMoney(d.balanceTiyin)}
                          </span>
                        </div>
                        {d.changeTiyin !== '0' && (
                          <div className="flex items-center justify-between gap-3 pt-0.5">
                            <span className="text-muted-foreground">O‘zgarish:</span>
                            <Amount value={d.changeTiyin} showSign={true} />
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balanceSom"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#balanceTrendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
