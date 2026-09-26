import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';
import { formatMoney, ListTransactionsQuery, TransactionType } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { TransactionFilterBar, FilterState } from './TransactionFilterBar';
import { TransactionTable } from './TransactionTable';
import { TransactionModal } from '../../features/transactions/components/TransactionModal';
import {
  useTransactions,
  useDeleteTransaction,
  useBulkDeleteTransactions,
} from '../../features/transactions/hooks/useTransactions';
import { useExportTransactions } from '../../features/transactions/hooks/useExport';

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const { exportData, isExporting } = useExportTransactions();

  // Parse filters from URL
  const filters: ListTransactionsQuery = useMemo(() => {
    return {
      page: Number(searchParams.get('page')) || 1,
      limit: 20,
      search: searchParams.get('search') || undefined,
      type: (searchParams.get('type') as TransactionType) || undefined,
      accountId: searchParams.get('accountId') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      sort: 'date:desc',
    };
  }, [searchParams]);

  const { data, isLoading, isError, error, refetch } = useTransactions(filters);
  const deleteTransaction = useDeleteTransaction();
  const bulkDeleteTransactions = useBulkDeleteTransactions();

  const transactions = data?.data ?? [];
  const meta = data?.meta;

  const handleExport = (format: 'csv' | 'xlsx') => {
    const exportQuery: Record<string, string | undefined> = {
      search: filters.search,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      from: filters.from,
      to: filters.to,
    };
    exportData(format, exportQuery);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    const nextParams = new URLSearchParams();
    if (newFilters.search) nextParams.set('search', newFilters.search);
    if (newFilters.type) nextParams.set('type', newFilters.type);
    if (newFilters.accountId) nextParams.set('accountId', newFilters.accountId);
    if (newFilters.categoryId) nextParams.set('categoryId', newFilters.categoryId);
    if (newFilters.from) nextParams.set('from', newFilters.from);
    if (newFilters.to) nextParams.set('to', newFilters.to);
    nextParams.set('page', '1');
    setSearchParams(nextParams);
    setSelectedIds(new Set());
  };

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams());
    setSelectedIds(new Set());
  };

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(newPage));
    setSearchParams(nextParams);
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
    if (transactions.every((t) => selectedIds.has(t.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (window.confirm('Haqiqatan ham bu tranzaksiyani o‘chirmoqchimisiz?')) {
      await deleteTransaction.mutateAsync(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      window.confirm(
        `Tanlangan ${selectedIds.size} ta tranzaksiyani o‘chirmoqchimisiz?`,
      )
    ) {
      await bulkDeleteTransactions.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tranzaksiyalar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kirim va chiqimlar ro‘yxati, hisoblararo o‘tkazmalar
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Button
              variant="outline"
              disabled={isExporting}
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Yuklanmoqda...' : 'Eksport'}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-xl bg-surface border border-border shadow-lg py-1 z-30">
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExport('csv');
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2 text-foreground"
                >
                  <FileText className="h-4 w-4 text-emerald-500" />
                  <span>CSV formatida</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExport('xlsx');
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2 text-foreground"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Excel (XLSX) formatida</span>
                </button>
              </div>
            )}
          </div>

          <Button onClick={() => setIsModalOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            <span>Yangi tranzaksiya</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards (meta.sums) */}
      {meta && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Filtr bo‘yicha kirim</p>
              <p className="text-xl font-extrabold text-success mt-1">
                +{formatMoney(meta.sums.income)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Filtr bo‘yicha chiqim</p>
              <p className="text-xl font-extrabold text-destructive mt-1">
                −{formatMoney(meta.sums.expense)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <TransactionFilterBar
        filters={{
          search: filters.search,
          type: filters.type,
          accountId: filters.accountId,
          categoryId: filters.categoryId,
          from: filters.from,
          to: filters.to,
        }}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Bulk actions banner */}
      {selectedIds.size > 0 && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-sm animate-in fade-in-50">
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

      {/* States: Loading, Error, Empty, Success */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : 'Tranzaksiyalarni yuklab bo‘lmadi'}
          onRetry={() => refetch()}
        />
      ) : transactions.length === 0 ? (
        <EmptyState
          title="Tranzaksiyalar topilmadi"
          description="Ushbu filtrlarga mos tranzaksiya mavjud emas yoki hali hech qanday amal kiritilmagan."
          action={
            <Button onClick={() => setIsModalOpen(true)}>Yangi tranzaksiya qo‘shish</Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <TransactionTable
            transactions={transactions}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onDelete={handleDeleteSingle}
            isDeleting={deleteTransaction.isPending}
          />

          {/* Pagination Controls */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Jami {meta.total} ta dan {((meta.page - 1) * meta.limit) + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} ko‘rsatilmoqda
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => handlePageChange(meta.page - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-semibold px-2">
                  {meta.page} / {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => handlePageChange(meta.page + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
