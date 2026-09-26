import { useState } from 'react';
import { useBudgetsStatus, useDeleteBudget } from '../../features/budgets/hooks/useBudgets';
import { BudgetStatusItem, formatMoney, formatIsoDate } from '@fintrack/shared';
import { BudgetModal } from '../../features/budgets/components/BudgetModal';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  PieChart,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function BudgetsPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    return formatIsoDate(new Date()).slice(0, 7); // YYYY-MM
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<BudgetStatusItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useBudgetsStatus(currentMonth);
  const deleteBudget = useDeleteBudget();

  const budgets = data?.data ?? [];
  const meta = data?.meta;

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(Date.UTC(year, month - 2, 1));
    setCurrentMonth(formatIsoDate(prevDate).slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextDate = new Date(Date.UTC(year, month, 1));
    setCurrentMonth(formatIsoDate(nextDate).slice(0, 7));
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Haqiqatan ham ushbu byudjet limitini o‘chirmoqchimisiz?')) {
      await deleteBudget.mutateAsync(id);
    }
  };

  const handleEdit = (item: BudgetStatusItem) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditItem(null);
    setModalOpen(true);
  };

  const totalLimitTiyin = BigInt(meta?.totalLimit ?? '0');
  const totalSpentTiyin = BigInt(meta?.totalSpent ?? '0');
  const totalRemainingTiyin =
    totalLimitTiyin > totalSpentTiyin ? totalLimitTiyin - totalSpentTiyin : 0n;
  const overallPercent =
    totalLimitTiyin > 0n ? Number((totalSpentTiyin * 100n) / totalLimitTiyin) : 0;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300 pb-12">
      {/* Top Header & Month Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <PieChart className="h-7 w-7 text-primary" />
            Oylik Byudjetlar
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Xarajat kategoriyalari bo‘yicha limitlar va xarajat nazorati
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-black px-2 min-w-[90px] text-center">
              {currentMonth}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            size="sm"
            className="rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            onClick={handleOpenCreate}
          >
            <PlusCircle className="mr-1.5 h-4 w-4" />
            <span>Byudjet belgilash</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jami Limit
            </span>
            <div className="text-xl font-black text-foreground">
              {formatMoney(totalLimitTiyin)}
            </div>
            <p className="text-[11px] text-muted-foreground">Belgilangan oylik limit</p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jami Sarflangan
            </span>
            <div
              className={cn(
                'text-xl font-black',
                overallPercent > 100
                  ? 'text-destructive'
                  : overallPercent >= 80
                    ? 'text-warning'
                    : 'text-foreground',
              )}
            >
              {formatMoney(totalSpentTiyin)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Limitdan {overallPercent}% sarflandi
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Qolgan Mablag‘
            </span>
            <div className="text-xl font-black text-success">
              {formatMoney(totalRemainingTiyin)}
            </div>
            <p className="text-[11px] text-muted-foreground">Limit tugashigacha qoldiq</p>
          </CardContent>
        </Card>
      </div>

      {/* Content: 4 states */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl border border-border/60 space-y-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="py-12">
          <ErrorState
            message={error instanceof Error ? error.message : 'Byudjetlarni yuklashda xatolik yuz berdi'}
            onRetry={refetch}
          />
        </div>
      ) : budgets.length === 0 ? (
        <div className="py-16">
          <EmptyState
            icon={<PieChart className="h-10 w-10 text-muted-foreground/60" />}
            title="Byudjetlar belgilanmagan"
            description={`Ushbu oy (${currentMonth}) uchun hali birorta kategoriya byudjeti kiritilmagan`}
            action={
              <Button size="sm" onClick={handleOpenCreate}>
                + Byudjet belgilash
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const isOk = b.state === 'OK';
            const isWarning = b.state === 'WARNING';
            const isExceeded = b.state === 'EXCEEDED';

            return (
              <Card
                key={b.id}
                className="border border-border/60 shadow-sm hover:border-primary/40 transition-all overflow-hidden"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Card Header: Category & State Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0">{b.category.icon}</span>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-foreground truncate">
                          {b.category.name}
                        </h3>
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
                        <span>
                          {isExceeded
                            ? 'Oshib ketdi'
                            : isWarning
                              ? '80% dan oshdi'
                              : 'Meʼyorda'}
                        </span>
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
                          <span>Qoldiq: <b className="text-foreground">{formatMoney(b.remaining)}</b></span>
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
                      onClick={() => handleEdit(b)}
                      className="text-xs h-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      Tahrirlash
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(b.id)}
                      className="text-xs h-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      O‘chirish
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <BudgetModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        month={currentMonth}
        editItem={editItem}
      />
    </div>
  );
}
