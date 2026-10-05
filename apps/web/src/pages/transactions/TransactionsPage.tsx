import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import {
  ListTransactionsQuery,
  TransactionType,
  isUserManagedTransactionType,
} from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { apiErrorToMessage } from '../../lib/apiError';
import { TransactionFilterBar, FilterState } from './TransactionFilterBar';
import { TransactionTable } from './TransactionTable';
import { TransactionModal } from '../../features/transactions/components/TransactionModal';
import { TransactionSums } from '../../features/transactions/components/TransactionSums';
import { ExportMenu } from '../../features/transactions/components/ExportMenu';
import {
  useTransactions,
  useDeleteTransaction,
  useBulkDeleteTransactions,
} from '../../features/transactions/hooks/useTransactions';
import { useDeleteTransfer } from '../../features/transfers/hooks/useTransfers';
import { PageHeader } from '../../components/layout/PageHeader';

const FILTER_KEYS = ['search', 'type', 'accountId', 'categoryId', 'from', 'to'] as const;

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, confirm] = useConfirm();

  // Filters live in the URL so a reload or a shared link shows the same list.
  const filters: ListTransactionsQuery = useMemo(
    () => ({
      page: Number(searchParams.get('page')) || 1,
      limit: 20,
      search: searchParams.get('search') || undefined,
      type: (searchParams.get('type') as TransactionType) || undefined,
      accountId: searchParams.get('accountId') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      sort: 'date:desc',
    }),
    [searchParams],
  );
  const filterValues: FilterState = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, filters[key]]),
  );

  const { data, isLoading, isError, error, refetch } = useTransactions(filters);
  const deleteTransaction = useDeleteTransaction();
  const bulkDeleteTransactions = useBulkDeleteTransactions();
  const deleteTransfer = useDeleteTransfer();

  const transactions = data?.data ?? [];
  const meta = data?.meta;

  const handleFilterChange = (next: FilterState) => {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = next[key];
      if (value) params.set(key, value);
    }
    params.set('page', '1');
    setSearchParams(params);
    setSelectedIds(new Set());
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    const deletable = transactions.filter((t) => isUserManagedTransactionType(t.type));
    setSelectedIds(
      deletable.every((t) => selectedIds.has(t.id))
        ? new Set()
        : new Set(deletable.map((t) => t.id)),
    );
  };

  const handleDeleteSingle = async (id: string) => {
    const confirmed = await confirm({
      title: 'Tranzaksiya o‘chirilsinmi?',
      description: 'O‘chirilgan yozuv balans va hisobotlardan chiqariladi.',
      confirmLabel: 'O‘chirish',
      destructive: true,
    });
    if (!confirmed) return;
    await deleteTransaction.mutateAsync(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirm({
      title: `${selectedIds.size} ta tranzaksiya o‘chirilsinmi?`,
      confirmLabel: 'O‘chirish',
      destructive: true,
    });
    if (!confirmed) return;
    await bulkDeleteTransactions.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleCancelTransfer = async (groupId: string) => {
    const confirmed = await confirm({
      title: 'O‘tkazma bekor qilinsinmi?',
      description: 'Ikkala hisobdagi yozuv ham o‘chiriladi va balanslar avvalgi holatiga qaytadi.',
      confirmLabel: 'Bekor qilish',
      destructive: true,
    });
    if (confirmed) await deleteTransfer.mutateAsync(groupId);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tranzaksiyalar"
        subtitle="Kirim va chiqimlar ro‘yxati, hisoblararo o‘tkazmalar"
        actions={
          <>
            <ExportMenu query={{ ...filterValues }} />
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Yangi tranzaksiya
            </Button>
          </>
        }
        mobileActions={
          <>
            <ExportMenu query={{ ...filterValues }} />
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Yangi tranzaksiya
            </Button>
          </>
        }
      />

      {meta && <TransactionSums income={meta.sums.income} expense={meta.sums.expense} />}

      <TransactionFilterBar
        filters={filterValues}
        onFilterChange={handleFilterChange}
        onReset={() => handleFilterChange({})}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm">
          <span className="font-semibold text-primary">
            {selectedIds.size} ta tranzaksiya tanlandi
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            loading={bulkDeleteTransactions.isPending}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            <span>O‘chirish</span>
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState message={apiErrorToMessage(error)} onRetry={() => refetch()} />
      ) : transactions.length === 0 ? (
        <EmptyState
          title="Tranzaksiyalar topilmadi"
          description="Ushbu filtrlarga mos tranzaksiya mavjud emas yoki hali hech qanday amal kiritilmagan."
          action={<Button onClick={() => setIsModalOpen(true)}>Yangi tranzaksiya qo‘shish</Button>}
        />
      ) : (
        <div className="space-y-4">
          <TransactionTable
            transactions={transactions}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onDelete={handleDeleteSingle}
            onCancelTransfer={handleCancelTransfer}
            isDeleting={deleteTransaction.isPending || deleteTransfer.isPending}
          />
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {confirmDialog}
    </div>
  );
}
