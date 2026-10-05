import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** 1, …, current±1, …, last. */
export function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const cell =
  'flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[14px] font-medium transition-colors duration-fast focus-ring';

/** "Jami 248 tadan 1–20 ko‘rsatilmoqda" with numbered pages. Hidden when everything fits on one. */
export function Pagination({ page, totalPages, total, limit, onPageChange, className }: PaginationProps) {
  if (total === 0) return null;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  // One page: only the count, no buttons.
  if (totalPages <= 1) {
    return (
      <p className={cn('text-[13px] text-text-muted', className)}>
        Jami {total} tadan {first}–{last} ko‘rsatilmoqda
      </p>
    );
  }

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Sahifalash">
      <span className="text-[13px] text-text-muted">
        Jami {total} tadan {first}–{last} ko‘rsatilmoqda
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(cell, 'text-text-secondary hover:bg-secondary disabled:opacity-40')}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Oldingi sahifa"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        {pageWindow(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-text-muted" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              aria-label={`${item}-sahifa`}
              className={cn(cell, item === page ? 'bg-primary text-primary-foreground' : 'text-text hover:bg-secondary')}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className={cn(cell, 'text-text-secondary hover:bg-secondary disabled:opacity-40')}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Keyingi sahifa"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
