import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { cn } from '../../../lib/utils';

interface ExpenseProgressBarProps {
  spentPercent?: number;
  isLoading?: boolean;
}

export function ExpenseProgressBar({ spentPercent = 0, isLoading }: ExpenseProgressBarProps) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      </Card>
    );
  }

  // 0–70 yashil, 70–100 sariq, >100 qizil
  const isOk = spentPercent <= 70;
  const isWarning = spentPercent > 70 && spentPercent <= 100;
  const isExceeded = spentPercent > 100;

  const barWidth = Math.min(spentPercent, 100);

  return (
    <Card className="border border-border/60 shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isOk && <CheckCircle2 className="h-4 w-4 text-success" />}
            {isWarning && <AlertTriangle className="h-4 w-4 text-warning" />}
            {isExceeded && <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />}
            <span className="text-sm font-bold text-foreground">
              Kirimga nisbatan xarajat ulushi
            </span>
          </div>

          <span
            className={cn(
              'text-sm font-black tracking-tight',
              isOk && 'text-success',
              isWarning && 'text-warning',
              isExceeded && 'text-destructive font-black',
            )}
          >
            {spentPercent.toFixed(1)}%
          </span>
        </div>

        {/* Progress bar container */}
        <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden relative">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isOk && 'bg-success',
              isWarning && 'bg-warning',
              isExceeded && 'bg-destructive',
            )}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Description / Alert text */}
        <div className="mt-2 text-xs">
          {isExceeded ? (
            <p className="text-destructive font-semibold flex items-center gap-1">
              <span>⚠️ Bu davrda daromadingizdan {(spentPercent - 100).toFixed(1)}% ko‘p sarfladingiz!</span>
            </p>
          ) : isWarning ? (
            <p className="text-warning font-medium">
              Xarajatlaringiz daromadingizning 70% idan oshdi. Moliyaviy intizomga eʼtibor bering.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Ajoyib! Xarajatlaringiz meʼyorida va tejash imkoniyati mavjud.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
