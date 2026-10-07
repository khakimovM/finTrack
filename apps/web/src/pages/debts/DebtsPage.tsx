import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Handshake, Plus } from 'lucide-react';
import type { DebtPaymentResponse, DebtResponse } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { useFormStore } from '../../stores/formStore';
import { DebtCard, type DebtCardActions } from '../../features/debts/components/DebtCard';
import { DebtModal } from '../../features/debts/components/DebtModal';
import { DebtPaymentModal } from '../../features/debts/components/DebtPaymentModal';
import { useAllDebts, useDeleteDebt, useDeleteDebtPayment } from '../../features/debts/hooks/useDebts';
import { matchesFilter, sortDebts, type DebtFilter } from '../../features/debts/debtView';
import { DebtFilters, DebtsSkeleton, DebtsSummary, type Direction } from './DebtsPageParts';

const CARD = 'rounded-[20px] border border-border bg-card';

export function DebtsPage() {
  const [confirmDialog, confirm] = useConfirm();
  const openForm = useFormStore((s) => s.open);
  const { data, isLoading, isError, refetch } = useAllDebts();
  const deleteDebt = useDeleteDebt();
  const deletePayment = useDeleteDebtPayment();

  const [direction, setDirection] = useState<Direction | null>(null);
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DebtResponse | null>(null);
  const [paying, setPaying] = useState<{ debt: DebtResponse; mode: 'pay' | 'settle' } | null>(null);

  // "Qarzga o‘tish" from a transaction lands here with ?debt=<id>: show it, open, ringed.
  const [params] = useSearchParams();
  const focusId = params.get('debt');
  const focusRef = useRef<HTMLElement>(null);
  const debts = data?.data ?? [];
  const focusFound = focusId !== null && debts.some((d) => d.id === focusId);
  useEffect(() => {
    if (!focusFound || !focusId) return;
    setDirection(null);
    setFilter('all');
    setOpenHistory((prev) => new Set(prev).add(focusId));
    focusRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [focusFound, focusId]);

  const inDirection = debts.filter((d) => !direction || d.direction === direction);
  const shown = sortDebts(inDirection.filter((d) => matchesFilter(d, filter)));

  const actions: DebtCardActions = {
    onPay: (debt) => setPaying({ debt, mode: 'pay' }),
    onSettle: (debt) => setPaying({ debt, mode: 'settle' }),
    onEdit: setEditing,
    onDelete: async (debt) => {
      const ok = await confirm({
        title: 'Qarz o‘chirilsinmi?',
        description: 'Unga bog‘liq barcha yozuvlar ham bekor qilinadi va balans tiklanadi.',
        confirmLabel: 'O‘chirish',
        destructive: true,
      });
      if (ok) await deleteDebt.mutateAsync(debt.id).catch(() => undefined);
    },
    onDeletePayment: async (debt: DebtResponse, payment: DebtPaymentResponse) => {
      const ok = await confirm({
        title: 'To‘lov o‘chirilsinmi?',
        description: 'Qoldiq va hisob balansi qayta hisoblanadi.',
        confirmLabel: 'O‘chirish',
        destructive: true,
      });
      if (ok) await deletePayment.mutateAsync({ debtId: debt.id, paymentId: payment.id }).catch(() => undefined);
    },
  };

  const openNew = () => openForm({ kind: 'debt' });
  const newButton = (
    <Button onClick={openNew}>
      <Plus className="h-[18px] w-[18px]" aria-hidden />
      Yangi qarz
    </Button>
  );
  const filtered = direction !== null || filter !== 'all';

  let body;
  if (isLoading) body = <DebtsSkeleton />;
  else if (isError) body = <ErrorState title="Qarzlarni yuklashda xatolik yuz berdi" onRetry={() => void refetch()} className={CARD} />;
  else if (shown.length === 0)
    body = (
      <EmptyState
        icon={<Handshake className="h-6 w-6" aria-hidden />}
        title={filtered && debts.length > 0 ? 'Mos qarz topilmadi' : 'Hozircha qarzlar yo‘q'}
        description={
          filtered && debts.length > 0 ? 'Ushbu filtrga mos qarz yo‘q.' : 'Kimga qarz berganingiz yoki kimdan olganingizni yozib boring.'
        }
        action={
          filtered && debts.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                setFilter('all');
                setDirection(null);
              }}
            >
              Filtrni tozalash
            </Button>
          ) : (
            <Button onClick={openNew}>Yangi qarz qo‘shish</Button>
          )
        }
        className={CARD}
      />
    );
  else
    body = (
      <div className="ft-stagger grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[repeat(auto-fill,minmax(440px,1fr))]">
        {shown.map((debt) => (
          <DebtCard
            key={debt.id}
            ref={debt.id === focusId ? focusRef : undefined}
            debt={debt}
            actions={actions}
            focused={debt.id === focusId}
            historyOpen={openHistory.has(debt.id)}
            onToggleHistory={() =>
              setOpenHistory((prev) => {
                const next = new Set(prev);
                if (next.has(debt.id)) next.delete(debt.id);
                else next.add(debt.id);
                return next;
              })
            }
          />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Qarzlar"
        subtitle="Berilgan va olingan qarzlar, qisman to‘lovlar va muddatlar"
        actions={newButton}
        mobileActions={newButton}
      />
      {data && <DebtsSummary summary={data.meta.summary} direction={direction} onDirection={setDirection} />}
      {debts.length > 0 && <DebtFilters debts={inDirection} value={filter} onChange={setFilter} />}
      {body}

      <DebtModal isOpen={editing !== null} onClose={() => setEditing(null)} debt={editing} />
      <DebtPaymentModal debt={paying?.debt ?? null} mode={paying?.mode} isOpen={paying !== null} onClose={() => setPaying(null)} />
      {confirmDialog}
    </div>
  );
}
