import { BudgetStatusItem, formatMoney } from '@fintrack/shared';
import { AlertCircle, AlertTriangle, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { cn } from '../../../lib/utils';

export interface BudgetCardProps {
  budget: BudgetStatusItem;
  onEdit: (budget: BudgetStatusItem) => void;
  onDelete: (id: string) => void;
}

/** One category budget: spent / limit / remaining, coloured by its state. */
export function BudgetCard({ budget: b, onEdit, onDelete }: BudgetCardProps) {
  const isOk = b.state === 'OK';
  const isWarning = b.state === 'WARNING';
  const isExceeded = b.state === 'EXCEEDED';

  return (
    <Card className="border border-border/60 shadow-sm hover:border-primary/40 transition-all overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Card Header: Category & State Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{b.category.icon}</span>
            <div className="min-w-0">
              <h3 className="text-base font-black text-foreground truncate">{b.category.name}</h3>
              <p className="text-xs text-muted-foreground">
                Limit: <b className="text-foreground">{formatMoney(b.limitAmount)}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant={isExceeded ? 'destructive' : isWarning ? 'warning' : 'success'}
              className="text-[11px] font-bold flex items-center gap-1"
            >
              {isExceeded && <AlertCircle className="h-3 w-3" />}
              {isWarning && <AlertTriangle className="h-3 w-3" />}
              {isOk && <CheckCircle2 className="h-3 w-3" />}
              <span>{isExceeded ? 'Oshib ketdi' : isWarning ? '80% dan oshdi' : 'Meʼyorda'}</span>
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Sarflangan: <b className="text-foreground">{formatMoney(b.spent)}</b>
            </span>
            <span
              className={cn(
                'font-black',
                isExceeded && 'text-destructive',
                isWarning && 'text-warning',
                isOk && 'text-success',
              )}
            >
              {b.percent.toFixed(1)}%
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden relative">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isExceeded && 'bg-destructive',
                isWarning && 'bg-warning',
                isOk && 'bg-success',
              )}
              style={{ width: `${Math.min(100, b.percent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
            <span>
              {isExceeded ? (
                <span className="text-destructive font-semibold">
                  ⚠️ Limitdan {formatMoney(BigInt(b.spent) - BigInt(b.limitAmount))} ko‘p sarflandi
                </span>
              ) : (
                <span>
                  Qoldiq: <b className="text-foreground">{formatMoney(b.remaining)}</b>
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(b)}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" />
            Tahrirlash
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(b.id)}
            className="text-xs h-8 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            O‘chirish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
