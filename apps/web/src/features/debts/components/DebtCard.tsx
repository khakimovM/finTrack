import { useEffect, useRef, useState } from 'react';
import { DebtResponse, formatMoney } from '@fintrack/shared';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Amount } from '../../../components/ui/Amount';
import { useDebtPayments } from '../hooks/useDebts';
import {
  Calendar,
  Phone,
  Clock,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { formatDate } from '../../../lib/format';

interface DebtCardProps {
  debt: DebtResponse;
  onAddPayment: (debt: DebtResponse) => void;
  onSettle: (debt: DebtResponse) => void;
  onDelete: (id: string) => void;
  /** Opened from a transaction ("Qarzga o‘tish"): scroll to it, outline it, show its payments. */
  highlighted?: boolean;
}

export function DebtCard({
  debt,
  onAddPayment,
  onSettle,
  onDelete,
  highlighted = false,
}: DebtCardProps) {
  const [showHistory, setShowHistory] = useState(highlighted);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlighted) return;
    setShowHistory(true);
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);
  const { data: payments = [], isLoading: loadingPayments } = useDebtPayments(
    showHistory ? debt.id : undefined,
  );

  const isLent = debt.direction === 'I_LENT';
  const totalAmount = BigInt(debt.amount);
  const paidAmount = BigInt(debt.paidAmount);
  const remainingAmount = BigInt(debt.remainingAmount);

  const percentPaid = totalAmount > 0n ? Number((paidAmount * 100n) / totalAmount) : 0;
  const isPaid = debt.status === 'PAID';

  return (
    <div ref={rootRef}>
      <Card
        className={cn(
          'border border-border/60 shadow-sm hover:border-primary/40 transition-all overflow-hidden',
          highlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <CardContent className="p-5 space-y-4">
          {/* Top Header: Person Info & Status Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-foreground truncate">{debt.personName}</h3>
                <Badge
                  variant={
                    isPaid ? 'success' : debt.status === 'PARTIALLY_PAID' ? 'warning' : 'outline'
                  }
                  className="text-[11px] font-bold"
                >
                  {isPaid
                    ? 'To‘langan'
                    : debt.status === 'PARTIALLY_PAID'
                      ? 'Qisman to‘langan'
                      : 'Faol'}
                </Badge>
              </div>

              {debt.personPhone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{debt.personPhone}</span>
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                {isLent ? 'Menga berishi kerak' : 'Men berishim kerak'}
              </span>
              <span className="text-lg font-black text-foreground">
                <Amount value={debt.amount} showSign={false} className="text-lg" />
              </span>
            </div>
          </div>

          {/* Progress Bar (To'langan ulush va qoldiq) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                To‘langan:{' '}
                <b className="text-foreground">
                  {formatMoney(paidAmount, { showFraction: false })}
                </b>{' '}
                ({percentPaid}%)
              </span>
              <span className="font-bold flex items-center gap-1">
                <span className="text-muted-foreground font-medium">Qoldiq:</span>
                <span className={cn(isPaid ? 'text-success' : 'text-primary')}>
                  {formatMoney(remainingAmount)}
                </span>
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden relative">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isPaid ? 'bg-success' : percentPaid > 0 ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
                style={{ width: `${Math.min(100, percentPaid)}%` }}
              />
            </div>
          </div>

          {/* Due Date & Alerts */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1 border-t border-border/40">
            <div className="flex items-center gap-3">
              {debt.dueDate ? (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Muddat: {formatDate(debt.dueDate)}</span>
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Muddatsiz</span>
                </span>
              )}

              {debt.isOverdue && !isPaid && (
                <span className="inline-flex items-center gap-1 text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded-md">
                  <AlertTriangle className="h-3 w-3" />
                  Muddati o‘tgan!
                </span>
              )}

              {!debt.isOverdue && debt.daysLeft !== null && debt.daysLeft <= 3 && !isPaid && (
                <span className="inline-flex items-center gap-1 text-warning font-bold bg-warning/10 px-2 py-0.5 rounded-md">
                  <Clock className="h-3 w-3" />
                  {debt.daysLeft} kun qoldi
                </span>
              )}
            </div>

            {debt.note && (
              <span className="text-muted-foreground italic truncate max-w-xs text-[11px]">
                &ldquo;{debt.note}&rdquo;
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              {showHistory ? (
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
              )}
              To‘lovlar tarixi
            </Button>

            <div className="flex items-center gap-2">
              {!isPaid && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddPayment(debt)}
                    className="text-xs h-8 font-bold"
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1 text-primary" />
                    To‘lov kiritish
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onSettle(debt)}
                    className="text-xs h-8 font-bold text-success hover:text-success"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-success" />
                    To‘liq yopish
                  </Button>
                </>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(debt.id)}
                className="text-xs h-8 text-destructive hover:bg-destructive/10"
                title="Qarzni o‘chirish"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Payment History Accordion */}
          {showHistory && (
            <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2 text-xs">
              <h4 className="font-bold text-foreground">To‘lovlar Tarixi</h4>
              {loadingPayments ? (
                <p className="text-muted-foreground">Yuklanmoqda...</p>
              ) : payments.length === 0 ? (
                <p className="text-muted-foreground">Hozircha hech qanday to‘lov kiritilmagan.</p>
              ) : (
                <div className="divide-y divide-border/30">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5">
                      <div>
                        <span className="font-semibold text-foreground">
                          {formatDate(p.paidAt)}
                        </span>
                        {p.note && <span className="text-muted-foreground ml-2">({p.note})</span>}
                      </div>
                      <span className="font-black text-success">+{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
