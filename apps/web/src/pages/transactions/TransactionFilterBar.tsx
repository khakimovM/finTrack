import { useState, useEffect } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useAccounts } from '../../features/accounts/hooks/useAccounts';
import { useCategories } from '../../features/categories/hooks/useCategories';
import { TransactionType } from '@fintrack/shared';

export interface FilterState {
  search?: string;
  type?: TransactionType | '';
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
}

export interface TransactionFilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
}

export function TransactionFilterBar({
  filters,
  onFilterChange,
  onReset,
}: TransactionFilterBarProps) {
  const { data: accountsData } = useAccounts();
  const { data: categories = [] } = useCategories();
  const accounts = accountsData?.data ?? [];

  // Local state for debounced search
  const [searchTerm, setSearchTerm] = useState(filters.search ?? '');

  useEffect(() => {
    setSearchTerm(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== (filters.search ?? '')) {
        onFilterChange({ ...filters, search: searchTerm || undefined });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, filters, onFilterChange]);

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.type ||
    filters.accountId ||
    filters.categoryId ||
    filters.from ||
    filters.to,
  );

  return (
    <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Izoh bo‘yicha qidiruv..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                onFilterChange({ ...filters, search: undefined });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter */}
        <Select
          value={filters.type ?? ''}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              type: (e.target.value as TransactionType) || undefined,
            })
          }
        >
          <option value="">Barcha turlar</option>
          <option value="EXPENSE">Chiqim</option>
          <option value="INCOME">Kirim</option>
          <option value="TRANSFER_OUT">O‘tkazma (chiqish)</option>
          <option value="TRANSFER_IN">O‘tkazma (kirish)</option>
          <option value="LOAN_GIVEN">Qarz berildi</option>
          <option value="LOAN_TAKEN">Qarz olindi</option>
          <option value="LOAN_REPAY_IN">Qarz qaytarildi (kirim)</option>
          <option value="LOAN_REPAY_OUT">Qarz qaytarildi (chiqim)</option>
        </Select>

        {/* Account Filter */}
        <Select
          value={filters.accountId ?? ''}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              accountId: e.target.value || undefined,
            })
          }
        >
          <option value="">Barcha hisoblar</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.icon} {acc.name}
            </option>
          ))}
        </Select>

        {/* Category Filter */}
        <Select
          value={filters.categoryId ?? ''}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              categoryId: e.target.value || undefined,
            })
          }
        >
          <option value="">Barcha kategoriyalar</option>
          {categories.map((cat) => (
            <optgroup key={cat.id} label={`${cat.icon} ${cat.name}`}>
              <option value={cat.id}>{cat.name} (Bosh)</option>
              {cat.children?.map((child) => (
                <option key={child.id} value={child.id}>
                  &nbsp;&nbsp;↳ {child.icon} {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      {/* Date Range & Reset Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Sana:</span>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => onFilterChange({ ...filters, from: e.target.value || undefined })}
            className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => onFilterChange({ ...filters, to: e.target.value || undefined })}
            className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Filtrlarni tozalash
          </Button>
        )}
      </div>
    </div>
  );
}
