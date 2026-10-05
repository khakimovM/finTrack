import { useState } from 'react';
import { useBudgetsStatus, useDeleteBudget } from '../../features/budgets/hooks/useBudgets';
import { BudgetStatusItem, formatMoney, formatIsoDate, todayLocalIso } from '@fintrack/shared';
import { BudgetModal } from '../../features/budgets/components/BudgetModal';
import { BudgetCard } from '../../features/budgets/components/BudgetCard';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  PieChart,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatMonth } from '../../lib/format';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';

export function BudgetsPage() {
  const [confirmDialog, confirm] = useConfirm();
  const [currentMonth, setCurrentMonth] = useState(() => {
    return todayLocalIso().slice(0, 7); // YYYY-MM
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
    if (
      await confirm({
        title: 'Byudjet limiti o‘chirilsinmi?',
        confirmLabel: 'O‘chirish',
        destructive: true,
      })
    ) {
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

  const budgetActions = (
    <>
      <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
        <Button variant="ghost" size="icon-xs" onClick={handlePrevMonth} aria-label="Oldingi oy">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <span className="min-w-[110px] px-1 text-center text-[14px] font-semibold" aria-live="polite">
          {formatMonth(currentMonth)}
        </span>
        <Button variant="ghost" size="icon-xs" onClick={handleNextMonth} aria-label="Keyingi oy">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <Button onClick={handleOpenCreate}>
        <Plus className="h-[18px] w-[18px]" aria-hidden />
        Byudjet belgilash
      </Button>
    </>
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300 pb-12">
      <PageHeader
        title="Byudjetlar"
        subtitle="Kategoriyalar bo‘yicha oylik limitlar"
        actions={budgetActions}
        mobileActions={budgetActions}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jami Limit
            </span>
            <div className="text-xl font-black text-foreground">{formatMoney(totalLimitTiyin)}</div>
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
            message={
              error instanceof Error ? error.message : 'Byudjetlarni yuklashda xatolik yuz berdi'
            }
            onRetry={refetch}
          />
        </div>
      ) : budgets.length === 0 ? (
        <div className="py-16">
          <EmptyState
            icon={<PieChart className="h-10 w-10 text-muted-foreground/60" />}
            title="Byudjetlar belgilanmagan"
            description={`${formatMonth(currentMonth)} uchun hali birorta kategoriya byudjeti kiritilmagan`}
            action={
              <Button size="sm" onClick={handleOpenCreate}>
                + Byudjet belgilash
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => (
            <BudgetCard key={b.id} budget={b} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
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
      {confirmDialog}
    </div>
  );
}
