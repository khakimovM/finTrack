import { useState } from 'react';
import type { CategoryStatsItem } from '@fintrack/shared';
import { formatPercent } from '../../../lib/format';
import { formatAmount, shortMoney, tiyinToChartNumber } from '../../../lib/money';
import { chartColorAt, colorVar } from '../../../lib/colors';
import { Donut } from '../../../components/charts/Donut';
import { BarList } from '../../../components/charts/BarList';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useStatsByCategory } from '../hooks/useDashboard';
import { WidgetCard, WidgetState } from './WidgetCard';

/** Uncategorised spending has no colour of its own. */
function colourOf(item: CategoryStatsItem, index: number): string {
  return item.categoryId ? colorVar(item.color) : chartColorAt(index);
}

const LEGEND_ROWS = 6;

/** Expense share by category: donut with the total in the hole, top six in the legend. */
export function ExpenseShareCard() {
  const query = useStatsByCategory('EXPENSE');
  const [showAll, setShowAll] = useState(false);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? '0';
  const top = items.slice(0, LEGEND_ROWS);
  const rest = items.slice(LEGEND_ROWS);
  const restAmount = rest.reduce((sum, i) => sum + BigInt(i.amount), 0n);

  const slices = [
    ...top.map((item, i) => ({
      name: item.name,
      value: tiyinToChartNumber(item.amount),
      color: colourOf(item, i),
      detail: `${formatPercent(item.percent)} · ${item.count} ta tranzaksiya`,
    })),
    ...(restAmount > 0n ? [{ name: 'Boshqalar', value: tiyinToChartNumber(restAmount), color: 'var(--chart-9)' }] : []),
  ];
  const legend = showAll ? items : top;

  return (
    <WidgetCard title="Xarajatlar taqsimoti" className="xl:col-span-5">
      <WidgetState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        skeleton={
          <div className="flex items-center gap-6">
            <div className="h-[156px] w-[156px] shrink-0 animate-ft-pulse rounded-full border-[20px] border-secondary" />
            <div className="flex flex-1 flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </div>
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState variant="widget" title="Xarajatlar mavjud emas" description="Ushbu davrda kategoriya bo‘yicha xarajat yozilmagan." />
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Donut
              ariaLabel="Xarajatlar taqsimoti diagrammasi"
              data={slices}
              center={
                <>
                  <span className="text-[11.5px] text-text-muted">Jami chiqim</span>
                  <span className="text-[17px] font-semibold leading-[22px]">{shortMoney(total)}</span>
                  <span className="text-[11.5px] text-text-muted">so‘m</span>
                </>
              }
            />
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
              <ul className="flex flex-col gap-2 text-[13px] leading-[18px]">
                {legend.map((item, i) => (
                  <li key={item.categoryId ?? `none-${i}`} className="grid grid-cols-[10px_1fr_auto] items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: colourOf(item, i) }} aria-hidden />
                    <span className="truncate">
                      {item.icon} {item.name}
                    </span>
                    <span className="font-medium text-text-secondary">{formatPercent(item.percent)}</span>
                  </li>
                ))}
              </ul>
              {rest.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="self-start rounded-sm text-[13px] font-medium text-text-secondary underline decoration-input underline-offset-[3px] hover:text-text focus-ring"
                >
                  {showAll ? 'Kamroq ko‘rsatish' : `+ yana ${rest.length} ta kategoriya`}
                </button>
              )}
            </div>
          </div>
        )}
      </WidgetState>
    </WidgetCard>
  );
}

/** Top eight expense categories as horizontal bars in their own colours. */
export function CategoryBarsCard() {
  const query = useStatsByCategory('EXPENSE');
  const items = (query.data?.items ?? []).slice(0, 8);
  return (
    <WidgetCard title="Kategoriyalar bo‘yicha xarajat">
      <WidgetState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        skeleton={
          <div className="flex flex-col gap-3">
            {[90, 75, 60, 45, 30, 15].map((w) => (
              <Skeleton key={w} className="h-2.5 rounded-full" style={{ width: `${w}%` }} />
            ))}
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState variant="widget" title="Ushbu davrda maʼlumot yo‘q" description="Boshqa davrni tanlang yoki tranzaksiya qo‘shing." />
        ) : (
          <BarList
            items={items.map((item, i) => ({
              key: item.categoryId ?? `none-${i}`,
              label: `${item.icon} ${item.name}`,
              value: tiyinToChartNumber(item.amount),
              display: formatAmount(item.amount),
              color: colourOf(item, i),
            }))}
          />
        )}
      </WidgetState>
    </WidgetCard>
  );
}
