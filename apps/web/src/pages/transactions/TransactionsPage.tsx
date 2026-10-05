import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpDown, Plus, SearchX, Trash2, Undo2 } from 'lucide-react';
import { CreateTransferInput, TransactionResponse, todayLocalIso } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { useIsMobile } from '../../lib/useMediaQuery';
import { cn } from '../../lib/utils';
import { useFormStore } from '../../stores/formStore';
import { useCategories } from '../../features/categories/hooks/useCategories';
import { TransactionSums } from '../../features/transactions/components/TransactionSums';
import { ExportMenu } from '../../features/transactions/components/ExportMenu';
import { TransactionFilters } from '../../features/transactions/components/TransactionFilters';
import { TransactionList } from '../../features/transactions/components/TransactionList';
import { TransactionInfoModal } from '../../features/transactions/components/TransactionInfoModal';
import type { RowActions } from '../../features/transactions/components/TransactionRowMenu';
import { ListSkeleton, BulkBar } from './TransactionsPageParts';
import {
  useBulkDeleteTransactions,
  useDeleteTransaction,
  useInfiniteTransactions,
  useTransactions,
} from '../../features/transactions/hooks/useTransactions';
import { useDeleteTransfer } from '../../features/transfers/hooks/useTransfers';
import {
  clearedFilters,
  hasAnyFilter,
  isGroupedByDay,
  readFilters,
  toApiFilters,
  toListQuery,
  writeFilters,
  type TxFilters,
} from '../../features/transactions/filters';
import { parentNames, rowKind } from '../../features/transactions/rowView';

/** The transfer as the user booked it, so "Qaytarish" can book it again. */
function transferInput(tx: TransactionResponse): CreateTransferInput | undefined {
  if (!tx.transferPeer) return undefined;
  const out = tx.type === 'TRANSFER_OUT';
  return {
    fromAccountId: out ? tx.account.id : tx.transferPeer.accountId,
    toAccountId: out ? tx.transferPeer.accountId : tx.account.id,
    amount: tx.amount,
    date: tx.date,
    note: tx.note ?? undefined,
  };
}

export function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const today = todayLocalIso();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const openForm = useFormStore((s) => s.open);
  const [confirmDialog, confirm] = useConfirm();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [info, setInfo] = useState<TransactionResponse | null>(null);
  const { data: tree = [] } = useCategories();
  const parents = useMemo(() => parentNames(tree), [tree]);

  // Desktop pages through the list; phones append ("Yana yuklash"). Only one of them runs.
  const listQuery = toListQuery(filters, today);
  const paged = useTransactions({ ...listQuery, page: filters.page }, { enabled: !isMobile });
  const infinite = useInfiniteTransactions(listQuery, { enabled: isMobile });
  const active = isMobile ? infinite : paged;
  const rows = (isMobile ? infinite.data?.pages.flatMap((p) => p.data) : paged.data?.data) ?? [];
  const meta = isMobile ? infinite.data?.pages[0]?.meta : paged.data?.meta;

  const deleteTransaction = useDeleteTransaction();
  const bulkDelete = useBulkDeleteTransactions();
  const deleteTransfer = useDeleteTransfer();

  const update = (patch: Partial<TxFilters>) => {
    setParams(writeFilters({ ...filters, ...patch, page: patch.page ?? 1 }), { replace: patch.page === undefined });
    setSelected(new Set());
  };

  // Deleting the last rows of the last page leaves the user past the end.
  const totalPages = meta?.totalPages ?? 0;
  useEffect(() => {
    if (!isMobile && totalPages > 0 && filters.page > totalPages) {
      setParams(writeFilters({ ...filters, page: totalPages }), { replace: true });
    }
  }, [isMobile, totalPages, filters, setParams]);

  const unselect = (ids: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

  const actions: RowActions & { onOpen: (tx: TransactionResponse) => void } = {
    onOpen: (tx) => (rowKind(tx) === 'entry' ? actions.onEdit(tx) : setInfo(tx)),
    onEdit: (tx) => openForm({ kind: 'transaction', type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE', transaction: tx }),
    onDelete: async (tx) => {
      const ok = await confirm({
        title: 'Tranzaksiya o‘chirilsinmi?',
        description: 'O‘chirilgan yozuv balans va hisobotlardan chiqariladi.',
        confirmLabel: 'O‘chirish',
        destructive: true,
      });
      if (!ok) return;
      await deleteTransaction.mutateAsync(tx.id).catch(() => undefined);
      unselect([tx.id]);
    },
    onCancelTransfer: async (tx) => {
      if (!tx.transferGroupId) return;
      setInfo(null);
      const ok = await confirm({
        title: 'O‘tkazma bekor qilinsinmi?',
        description: 'Ikkala hisobdagi yozuv ham o‘chiriladi va balanslar avvalgi holatiga qaytadi.',
        confirmLabel: 'O‘tkazmani bekor qilish',
        cancelLabel: 'Yopish',
        destructive: true,
        icon: Undo2,
      });
      if (ok) await deleteTransfer.mutateAsync({ groupId: tx.transferGroupId, original: transferInput(tx) }).catch(() => undefined);
    },
    onOpenDebt: (tx) => {
      setInfo(null);
      if (tx.debtId) navigate(`/app/debts?debt=${encodeURIComponent(tx.debtId)}`);
    },
  };

  const selectable = rows.filter((tx) => rowKind(tx) === 'entry');
  const selection = {
    ids: selected,
    toggle: (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () =>
      setSelected(selectable.length > 0 && selectable.every((tx) => selected.has(tx.id)) ? new Set() : new Set(selectable.map((tx) => tx.id))),
  };

  const removeSelected = async () => {
    const ids = [...selected];
    const ok = await confirm({
      title: ids.length > 1 ? `${ids.length} ta tranzaksiya o‘chirilsinmi?` : 'Tranzaksiya o‘chirilsinmi?',
      description: 'O‘chirilgan yozuv balans va hisobotlardan chiqariladi.',
      confirmLabel: 'O‘chirish',
      destructive: true,
      icon: Trash2,
    });
    if (!ok) return;
    await bulkDelete.mutateAsync(ids).catch(() => undefined);
    unselect(ids);
  };

  const exportQuery = toApiFilters(filters, today);
  const openNew = () => openForm({ kind: 'transaction', type: 'EXPENSE' });
  const openTransfer = () => openForm({ kind: 'transfer' });
  const total = meta?.total ?? 0;

  let body: ReactNode;
  if (active.isLoading) body = <ListSkeleton table={!isMobile} />;
  else if (active.isError)
    body = <ErrorState title="Tranzaksiyalarni yuklab bo‘lmadi" onRetry={() => void active.refetch()} className="flex-1" />;
  else if (total === 0 && !hasAnyFilter(filters))
    body = (
      <EmptyState
        icon={<ArrowUpDown className="h-6 w-6" aria-hidden />}
        title="Hali tranzaksiyalar yo‘q"
        description="Kirim yoki chiqimni qo‘shing — u shu yerda paydo bo‘ladi."
        action={
          <Button onClick={openNew}>
            <Plus className="h-[18px] w-[18px]" aria-hidden />
            Birinchi tranzaksiyani qo‘shish
          </Button>
        }
        className="flex-1"
      />
    );
  else if (total === 0)
    body = (
      <EmptyState
        icon={<SearchX className="h-6 w-6" aria-hidden />}
        title="Tranzaksiyalar topilmadi"
        description="Ushbu filtrlarga mos tranzaksiya mavjud emas."
        action={
          <Button variant="outline" onClick={() => update(clearedFilters(filters.sort))}>
            Filtrlarni tozalash
          </Button>
        }
        className="flex-1"
      />
    );
  else
    body = (
      <>
        <TransactionList
          variant={isMobile ? 'cards' : 'table'}
          transactions={rows}
          grouped={isGroupedByDay(filters.sort)}
          today={today}
          parents={parents}
          actions={actions}
          selection={isMobile ? undefined : selection}
        />
        {isMobile ? (
          <div className="flex flex-col items-center gap-2.5 pb-2 pt-4">
            {infinite.hasNextPage && (
              <Button variant="outline" className="w-full" loading={infinite.isFetchingNextPage} onClick={() => void infinite.fetchNextPage()}>
                Yana yuklash
              </Button>
            )}
            <span className="text-[13px] text-text-muted">
              Jami {total} tadan 1–{rows.length} ko‘rsatilmoqda
            </span>
          </div>
        ) : (
          meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={(page) => update({ page })}
              className="px-4 py-3.5"
            />
          )
        )}
      </>
    );

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Tranzaksiyalar"
        subtitle="Kirim va chiqimlar ro‘yxati, hisoblararo o‘tkazmalar"
        actions={
          <>
            <ExportMenu query={exportQuery} />
            <Button variant="outline" onClick={openTransfer}>
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              O‘tkazma
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Yangi tranzaksiya
            </Button>
          </>
        }
        mobileIcon={<ExportMenu query={exportQuery} variant="icon" />}
        mobileActionsLayout="lead"
        mobileActions={
          <>
            <Button variant="outline" onClick={openTransfer}>
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              O‘tkazma
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Yangi tranzaksiya
            </Button>
          </>
        }
      />

      {meta && <TransactionSums sums={meta.sums} />}

      <TransactionFilters filters={filters} onChange={update} onClear={() => update(clearedFilters(filters.sort))} total={total} />

      {!isMobile && selected.size > 0 && (
        <BulkBar count={selected.size} onCancel={() => setSelected(new Set())} onDelete={() => void removeSelected()} busy={bulkDelete.isPending} />
      )}

      <section
        aria-label="Tranzaksiyalar ro‘yxati"
        className={cn('flex min-h-[320px] flex-col', !isMobile && 'rounded-[20px] border border-border bg-card')}
      >
        {body}
      </section>

      <TransactionInfoModal
        transaction={info}
        onClose={() => setInfo(null)}
        onCancelTransfer={(tx) => void actions.onCancelTransfer(tx)}
        onOpenDebt={actions.onOpenDebt}
      />
      {confirmDialog}
    </div>
  );
}
