import { StatsSummaryResponse } from '@fintrack/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Amount } from '../../../components/ui/Amount';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Wallet, TrendingUp, TrendingDown, Scale, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface KpiCardsProps {
  summary?: StatsSummaryResponse;
  isLoading?: boolean;
}

export function KpiCards({ summary, isLoading }: KpiCardsProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-28" />
          </Card>
        ))}
      </div>
    );
  }

  const { periodIncome, periodExpense, totalBalance, debt, previousPeriod } = summary;

  // Qarz saldosi (BigInt)
  const debtNetTiyin = BigInt(debt.net);
  const isDebtPositive = debtNetTiyin > 0n;
  const isDebtNegative = debtNetTiyin < 0n;

  // O'zgarish foizi
  const changePercent = previousPeriod.changePercent;
  const isIncomeUp = changePercent >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Umumiy Balans */}
      <Card className="hover:border-primary/40 transition-all shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Umumiy Balans
          </CardTitle>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black">
            <Amount value={totalBalance} className="text-2xl" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <span>Barcha hisoblar jami</span>
          </p>
        </CardContent>
      </Card>

      {/* 2. Davr Kirimi */}
      <Card className="hover:border-success/40 transition-all shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Davr Kirimi
          </CardTitle>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
            <TrendingUp className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black">
            <Amount value={periodIncome} type="INCOME" className="text-2xl" />
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center font-bold',
                isIncomeUp ? 'text-success' : 'text-destructive',
              )}
            >
              {isIncomeUp ? (
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
              )}
              {Math.abs(changePercent)}%
            </span>
            <span>o‘tgan davrga nisbatan</span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Davr Chiqimi */}
      <Card className="hover:border-destructive/40 transition-all shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Davr Chiqimi
          </CardTitle>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TrendingDown className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-black">
            <Amount value={periodExpense} type="EXPENSE" className="text-2xl" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Tanlangan davrdagi jami xarajatlar
          </p>
        </CardContent>
      </Card>

      {/* 4. Qarzlar Saldosi */}
      <Card
        className={cn(
          'hover:border-warning/40 transition-all shadow-sm',
          isDebtNegative && 'hover:border-destructive/40',
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Qarz Saldosi
          </CardTitle>
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl',
              isDebtPositive && 'bg-success/10 text-success',
              isDebtNegative && 'bg-warning/10 text-warning',
              !isDebtPositive && !isDebtNegative && 'bg-muted text-muted-foreground',
            )}
          >
            <Scale className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-2xl font-black',
              isDebtPositive && 'text-success',
              isDebtNegative && 'text-warning font-bold',
            )}
          >
            <Amount value={debt.net} showSign={true} className="text-2xl" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {debt.overdueCount > 0 ? (
              <span className="text-destructive font-semibold">
                ⚠️ {debt.overdueCount} ta muddati o‘tgan qarz
              </span>
            ) : (
              'Berilgan va olingan qarzlar farqi'
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
