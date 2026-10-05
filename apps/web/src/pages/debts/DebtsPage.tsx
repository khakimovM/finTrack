import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebt, useDebts, useDeleteDebt } from '../../features/debts/hooks/useDebts';
import { DebtResponse, DebtDirection, DebtStatus, formatMoney } from '@fintrack/shared';
import { DebtCard } from '../../features/debts/components/DebtCard';
import { DebtModal } from '../../features/debts/components/DebtModal';
import { DebtPaymentModal } from '../../features/debts/components/DebtPaymentModal';
import { SettleDebtModal } from '../../features/debts/components/SettleDebtModal';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Scale, ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';

type FilterStatus = 'ALL' | DebtStatus | 'OVERDUE';

export function DebtsPage() {
  const [confirmDialog, confirm] = useConfirm();
  const [direction, setDirection] = useState<DebtDirection>('I_LENT');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  // "Qarzga o‘tish" from a transaction row lands here with ?debt=<id>.
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('debt') ?? undefined;
  const focused = useDebt(focusId);
  useEffect(() => {
    if (!focused.data) return;
    setDirection(focused.data.direction);
    setFilterStatus('ALL');
  }, [focused.data]);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalDebt, setPaymentModalDebt] = useState<DebtResponse | null>(null);
  const [settleModalDebt, setSettleModalDebt] = useState<DebtResponse | null>(null);

  const deleteDebt = useDeleteDebt();

  const queryParams: Record<string, unknown> = {
    direction,
    limit: 100,
  };

  if (filterStatus === 'OVERDUE') {
    queryParams.overdue = true;
  } else if (filterStatus !== 'ALL') {
    queryParams.status = filterStatus;
  }

  const { data, isLoading, isError, error, refetch } = useDebts(queryParams);
  const debts = data?.data ?? [];
  const summary = data?.meta?.summary;

  const handleDelete = async (id: string) => {
    if (
      await confirm({
        title: 'Qarz o‘chirilsinmi?',
        description: 'Unga bog‘liq ledger tranzaksiyalari ham bekor qilinadi.',
        confirmLabel: 'O‘chirish',
        destructive: true,
      })
    ) {
      await deleteDebt.mutateAsync(id);
    }
  };

  const newDebtButton = (
    <Button onClick={() => setCreateModalOpen(true)}>
      <Plus className="h-[18px] w-[18px]" aria-hidden />
      Yangi qarz
    </Button>
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300 pb-12">
      <PageHeader
        title="Qarzlar"
        subtitle="Berilgan va olingan qarzlar, qisman to‘lovlar va muddatlar"
        actions={newDebtButton}
        mobileActions={newDebtButton}
      />

      {/* Main Tabs: Menga qarzdor / Men qarzdorman */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setDirection('I_LENT')}
          className={cn(
            'flex items-center justify-between p-4 rounded-2xl border text-left transition-all',
            direction === 'I_LENT'
              ? 'bg-success/10 border-success/40 shadow-sm shadow-success/5 ring-1 ring-success/30'
              : 'bg-card/60 border-border/60 hover:border-border text-muted-foreground',
          )}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4" /> Menga qarzdor (Men berdim)
            </span>
            <div className="text-xl font-black text-foreground">
              {summary ? formatMoney(summary.owedToMe) : '0,00 so‘m'}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Kutilayotgan qaytuvlar</span>
        </button>

        <button
          type="button"
          onClick={() => setDirection('I_BORROWED')}
          className={cn(
            'flex items-center justify-between p-4 rounded-2xl border text-left transition-all',
            direction === 'I_BORROWED'
              ? 'bg-warning/10 border-warning/40 shadow-sm shadow-warning/5 ring-1 ring-warning/30'
              : 'bg-card/60 border-border/60 hover:border-border text-muted-foreground',
          )}
        >
          <div className="space-y-1">
            <span className="text-xs font-bold text-warning uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownLeft className="h-4 w-4" /> Men qarzdorman (Men oldim)
            </span>
            <div className="text-xl font-black text-foreground">
              {summary ? formatMoney(summary.iOwe) : '0,00 so‘m'}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">To‘lanishi kerak bo‘lgan</span>
        </button>
      </div>

      {/* Status Filter Buttons */}
      <div className="inline-flex items-center gap-1 rounded-2xl bg-muted/60 p-1 backdrop-blur-sm border border-border/50 overflow-x-auto max-w-full">
        {(
          [
            { key: 'ALL', label: 'Barchasi' },
            { key: 'ACTIVE', label: 'Faol' },
            { key: 'PARTIALLY_PAID', label: 'Qisman to‘langan' },
            { key: 'PAID', label: 'To‘langan' },
            { key: 'OVERDUE', label: 'Muddati o‘tgan' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterStatus(f.key)}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap min-h-[36px]',
              filterStatus === f.key
                ? 'bg-background text-foreground shadow-sm font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content: 4 states */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl border border-border/60 space-y-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="py-12">
          <ErrorState
            message={
              error instanceof Error ? error.message : 'Qarzlarni yuklashda xatolik yuz berdi'
            }
            onRetry={refetch}
          />
        </div>
      ) : debts.length === 0 ? (
        <div className="py-16">
          <EmptyState
            icon={<Scale className="h-10 w-10 text-muted-foreground/60" />}
            title="Qarzlar topilmadi"
            description={
              filterStatus !== 'ALL'
                ? 'Ushbu filtr bo‘yicha hech qanday qarz mavjud emas'
                : 'Hozircha birorta ham qarz qayd etilmagan'
            }
            action={
              <Button size="sm" onClick={() => setCreateModalOpen(true)}>
                + Yangi qarz qo‘shish
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              onAddPayment={(debt) => setPaymentModalDebt(debt)}
              onSettle={(debt) => setSettleModalDebt(debt)}
              onDelete={handleDelete}
              highlighted={d.id === focusId}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <DebtModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultDirection={direction}
      />

      <DebtPaymentModal
        debt={paymentModalDebt}
        isOpen={Boolean(paymentModalDebt)}
        onClose={() => setPaymentModalDebt(null)}
      />

      <SettleDebtModal
        debt={settleModalDebt}
        isOpen={Boolean(settleModalDebt)}
        onClose={() => setSettleModalDebt(null)}
      />
      {confirmDialog}
    </div>
  );
}
