import { ArrowUpDown, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatAmount } from '../../lib/money';
import { cn } from '../../lib/utils';

/** The total of all accounts; it turns red when the money is below zero. */
export function AccountsBanner({ total, activeCount }: { total: string; activeCount: number }) {
  const negative = BigInt(total) < 0n;
  const chip = cn(
    'flex h-8 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium',
    negative ? 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]' : 'bg-[color-mix(in_srgb,var(--primary-foreground)_12%,transparent)]',
  );
  return (
    <section
      aria-label="Jami balans"
      className={cn(
        'flex flex-wrap items-end gap-x-8 gap-y-4 rounded-[20px] px-4 py-5 sm:p-6',
        negative ? 'bg-danger-soft text-text' : 'bg-primary text-primary-foreground',
      )}
    >
      <div className="flex flex-[1_1_260px] flex-col gap-1">
        <span className="text-[14px] opacity-75">Jami balans</span>
        <span
          className={cn(
            'flex items-center gap-2.5 whitespace-nowrap text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] tabular-nums sm:text-[44px]',
            negative && 'text-danger',
          )}
        >
          {negative && <TriangleAlert className="h-[0.8em] w-[0.8em] shrink-0" aria-label="Manfiy balans" />}
          {formatAmount(total, { sign: 'negative', currency: false })}{' '}
          <span className="text-[0.45em] font-medium tracking-normal opacity-70">so‘m</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={chip}>Faol hisoblar: {activeCount} ta</span>
        <span className={chip}>Valyuta: UZS (O‘zbek so‘mi)</span>
      </div>
    </section>
  );
}

export function AccountsSkeleton({ compact }: { compact: boolean }) {
  return (
    <div role="status" aria-label="Yuklanmoqda" className={cn('grid gap-4', !compact && 'grid-cols-[repeat(auto-fill,minmax(300px,1fr))]')}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn('flex items-start gap-3 rounded-[20px] border border-border bg-card p-5', compact ? 'h-[84px]' : 'h-[176px]')}
        >
          <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-[13px] w-3/5 rounded-[6px]" />
            <Skeleton className="h-[11px] w-[35%] rounded-[6px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ReorderBarProps {
  reordering: boolean;
  canStart: boolean;
  saving: boolean;
  onStart: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function ReorderBar({ reordering, canStart, saving, onStart, onCancel, onSave }: ReorderBarProps) {
  if (!reordering) {
    if (!canStart) return null;
    return (
      <Button variant="ghost" size="sm" onClick={onStart} className="max-sm:px-2.5">
        <ArrowUpDown className="h-4 w-4" aria-hidden />
        Tartibni o‘zgartirish
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-text-muted">Kartalarni sudrab joylashtiring</span>
      <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
        Bekor qilish
      </Button>
      <Button size="sm" onClick={onSave} loading={saving}>
        Saqlash
      </Button>
    </div>
  );
}
