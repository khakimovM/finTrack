import { Trash2 } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/utils';

const WIDTHS = ['62%', '48%', '70%', '55%', '40%', '66%', '52%', '58%'];

/** Eight rows shaped like the list while the first page loads. */
export function ListSkeleton({ table }: { table: boolean }) {
  return (
    <div role="status" aria-label="Yuklanmoqda" className="flex flex-col">
      {WIDTHS.map((width) => (
        <div key={width} className={cn('flex h-[60px] items-center gap-3 border-b border-border', table && 'px-4')}>
          <Skeleton className="h-9 w-9 shrink-0 rounded-[10px]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 rounded-[6px]" style={{ width }} />
            <Skeleton className="h-2.5 w-[30%] rounded-[6px]" />
          </div>
          <Skeleton className="h-3 w-[90px] rounded-[6px]" />
        </div>
      ))}
    </div>
  );
}

/** Desktop only: what is selected, and the one thing to do with it. */
export function BulkBar({ count, onCancel, onDelete, busy }: { count: number; onCancel: () => void; onDelete: () => void; busy: boolean }) {
  return (
    <div className="sticky top-[84px] z-[24] flex items-center gap-2 rounded-2xl bg-primary py-2 pl-4 pr-2 text-primary-foreground shadow-md">
      <span className="flex-1 text-[14px] font-semibold">{count} ta tranzaksiya tanlandi</span>
      <button
        type="button"
        onClick={onCancel}
        className="h-9 rounded-full bg-[color-mix(in_srgb,var(--primary-foreground)_14%,transparent)] px-3.5 text-[13px] font-medium focus-ring"
      >
        Bekor qilish
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="flex h-9 items-center gap-1.5 rounded-full bg-danger px-3.5 text-[13px] font-medium text-danger-foreground focus-ring disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        O‘chirish
      </button>
    </div>
  );
}
