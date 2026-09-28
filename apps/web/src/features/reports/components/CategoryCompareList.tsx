import { StatsCompareCategoryItem, formatMoney } from '@fintrack/shared';
import { ChangeBadge } from './ChangeBadge';

/**
 * Spending per category in both periods. A list rather than a table so it reads the same on a
 * 375px phone (docs/05: tables become cards on mobile).
 */
export function CategoryCompareList({ items }: { items: StatsCompareCategoryItem[] }) {
  const max = items.reduce((m, i) => {
    const a = BigInt(i.currentAmount);
    const b = BigInt(i.previousAmount);
    const bigger = a > b ? a : b;
    return bigger > m ? bigger : m;
  }, 0n);
  const width = (tiyin: string) => (max === 0n ? 0 : Number((BigInt(tiyin) * 1000n) / max) / 10);

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {items.map((item) => (
        <li key={item.categoryId ?? 'none'} className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span aria-hidden="true">{item.icon}</span>
              <span className="truncate">{item.name}</span>
            </span>
            <ChangeBadge
              current={item.currentAmount}
              previous={item.previousAmount}
              percent={item.changePercent}
              growthIsGood={false}
            />
          </div>
          <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
            <span className="text-muted-foreground">Hozir</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full"
                style={{ width: `${width(item.currentAmount)}%`, backgroundColor: item.color }}
              />
            </div>
            <span className="text-right font-semibold">{formatMoney(item.currentAmount)}</span>
            <span className="text-muted-foreground">Oldin</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-muted-foreground/40"
                style={{ width: `${width(item.previousAmount)}%` }}
              />
            </div>
            <span className="text-right text-muted-foreground">
              {formatMoney(item.previousAmount)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
