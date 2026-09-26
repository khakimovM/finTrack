import { Link } from 'react-router-dom';
import { useStatsDebts } from '../hooks/useDashboard';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Amount } from '../../../components/ui/Amount';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Scale, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function DebtSummaryWidget() {
  const { data, isLoading } = useStatsDebts();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  const {
    owedToMe = '0',
    iOwe = '0',
    net = '0',
    overdueCount = 0,
    activeCount = 0,
    partiallyPaidCount = 0,
  } = data ?? {};

  const netTiyin = BigInt(net);
  const isNetPositive = netTiyin > 0n;
  const isNetNegative = netTiyin < 0n;

  return (
    <Card className="border border-border/60 shadow-sm flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Qarzlar Xulosasi
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs h-8 text-primary font-semibold" asChild>
          <Link to="/app/debts">
            Barchasi <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col justify-between space-y-4">
        {/* Overdue alert if any */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">
              {overdueCount} ta qarzning to‘lov muddati o‘tib ketgan!
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Menga qarzdor */}
          <div className="p-3 rounded-2xl bg-success/10 border border-success/20 space-y-1">
            <span className="text-[11px] font-bold text-success uppercase tracking-wider">
              Menga qarzdor
            </span>
            <div className="text-sm sm:text-base font-black text-success">
              <Amount value={owedToMe} showSign={false} className="text-success" />
            </div>
            <p className="text-[10px] text-muted-foreground">Kutilayotgan qaytuvlar</p>
          </div>

          {/* Men qarzdorman */}
          <div className="p-3 rounded-2xl bg-warning/10 border border-warning/20 space-y-1">
            <span className="text-[11px] font-bold text-warning uppercase tracking-wider">
              Men qarzdorman
            </span>
            <div className="text-sm sm:text-base font-black text-warning">
              <Amount value={iOwe} showSign={false} className="text-warning" />
            </div>
            <p className="text-[10px] text-muted-foreground">To‘lanishi kerak bo‘lgan</p>
          </div>
        </div>

        {/* Net & Counts Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground">Umumiy Saldo:</span>
            <div className="font-black">
              <Amount
                value={net}
                showSign={true}
                className={cn(
                  'text-sm font-black',
                  isNetPositive && 'text-success',
                  isNetNegative && 'text-warning',
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <span>Faol: <b className="text-foreground">{activeCount}</b></span>
            <span>·</span>
            <span>Qisman: <b className="text-foreground">{partiallyPaidCount}</b></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
