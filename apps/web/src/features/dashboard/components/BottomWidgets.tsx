import { Link } from 'react-router-dom';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import type { DebtResponse, TransactionResponse } from '@fintrack/shared';
import { todayLocalIso } from '@fintrack/shared';
import { formatRelativeDay } from '../../../lib/format';
import { currencyWord, formatAmount, formatAmountNumber, NBSP } from '../../../lib/money';
import { Amount } from '../../../components/ui/Amount';
import { Avatar } from '../../../components/ui/Avatar';
import { Chip } from '../../../components/ui/Chip';
import { EmojiTile } from '../../../components/ui/EmojiTile';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Progress, budgetToneOf } from '../../../components/ui/Progress';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useBudgetsStatus } from '../../budgets/hooks/useBudgets';
import { BUDGET_LABEL } from '../../budgets/components/BudgetCard';
import { useDebts } from '../../debts/hooks/useDebts';
import { useTransactions } from '../../transactions/hooks/useTransactions';
import { typeLabel } from '../../transactions/typeLabels';
import { TxTile, rowKind, rowTitle } from '../../transactions/rowView';
import { useStatsDebts } from '../hooks/useDashboard';
import { WidgetCard, WidgetState } from './WidgetCard';
import { t, tn } from '../../../lib/i18n';


/** This month's budgets, the fullest first. */
export function BudgetsWidget() {
  const month = todayLocalIso().slice(0, 7);
  const query = useBudgetsStatus(month);
  const items = [...(query.data?.data ?? [])].sort((a, b) => b.percent - a.percent).slice(0, 4);

  return (
    <WidgetCard title={t('nav.budgets')} to="/app/budgets">
      <WidgetState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        errorTitle={t('budgets.page.loadFailed')}
        skeleton={
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3.5" />
                <Skeleton className="h-1.5 rounded-full" />
              </div>
            ))}
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            variant="widget"
            title={t('dashboard.widgets.budgetsEmpty')}
            description={t('dashboard.widgets.budgetsEmptyText')}
            action={
              <Link to="/app/budgets" className="text-[13px] font-medium underline underline-offset-[3px] focus-ring">
                {t('budgets.page.new')}
              </Link>
            }
            className="min-h-[180px]"
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((b) => {
              const tone = budgetToneOf(BigInt(b.spent), BigInt(b.limitAmount));
              return (
                <li key={b.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <EmojiTile emoji={b.category.icon} color={b.category.color} size={32} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium leading-5">{b.category.name}</span>
                      <span className="text-[12px] leading-4 text-text-muted">
                        {formatAmountNumber(b.spent)} / {formatAmountNumber(b.limitAmount)}
                        {NBSP}
                        {currencyWord()} · {Math.round(b.percent)}%
                      </span>
                    </span>
                    <Chip tone={tone} dot size="sm">
                      {t(BUDGET_LABEL[tone as keyof typeof BUDGET_LABEL])}
                    </Chip>
                  </div>
                  <Progress value={b.percent} tone={tone} size="thin" aria-label={`${b.category.name}: ${Math.round(b.percent)}%`} />
                </li>
              );
            })}
          </ul>
        )}
      </WidgetState>
    </WidgetCard>
  );
}

/** Dashboard rows lead with the category; the transactions list leads with the note. */
function txTitle(tx: TransactionResponse): string {
  return rowKind(tx) === 'entry' ? tx.category?.name ?? tx.note ?? typeLabel(tx.type) : rowTitle(tx);
}

/** The last five entries of any kind; transfers and debt movements keep their own look. */
export function RecentTransactionsCard() {
  const query = useTransactions({ limit: 5 });
  const today = todayLocalIso();
  const items = query.data?.data ?? [];

  return (
    <WidgetCard title={t('dashboard.widgets.recent')} to="/app/transactions">
      <WidgetState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        errorTitle={t('transactions.page.loadFailed')}
        skeleton={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState variant="widget" title={t('dashboard.widgets.recentEmpty')} description={t('dashboard.widgets.recentEmptyText')} className="min-h-[180px]" />
        ) : (
          <ul className="-my-1 flex flex-col">
            {items.map((tx) => (
              <li key={tx.id} className="flex min-h-[58px] items-center gap-3">
                <TxTile tx={tx} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-medium leading-5">{txTitle(tx)}</span>
                  <span className="truncate text-[12px] leading-4 text-text-muted">
                    {tx.account.name} · {formatRelativeDay(tx.date, today)}
                  </span>
                </span>
                <Amount value={tx.amount} type={tx.type} className="text-[14px]" />
              </li>
            ))}
          </ul>
        )}
      </WidgetState>
    </WidgetCard>
  );
}

function dueChip(debt: DebtResponse) {
  if (debt.isOverdue) {
    return (
      <Chip tone="danger" size="sm" className="font-semibold">
        {t('debts.due.overdue')}
      </Chip>
    );
  }
  if (debt.daysLeft === 0) return <Chip tone="warning" size="sm">{t('debts.due.today')}</Chip>;
  return <Chip tone="warning" size="sm">{tn('debts.due.daysLeft', debt.daysLeft ?? 0)}</Chip>;
}

/** Who owes whom, overdue first, and the nearest due dates. */
export function DebtsWidget() {
  const stats = useStatsDebts();
  const debts = useDebts({ limit: 100 });
  const s = stats.data;
  const upcoming = (debts.data?.data ?? [])
    .filter((d) => d.status !== 'PAID' && (d.isOverdue || (d.daysLeft !== null && d.daysLeft <= 7)))
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
    .slice(0, 3);
  // People, not debts: lending to Ali twice is still one person who owes.
  const people = (direction: DebtResponse['direction']) =>
    new Set(
      (debts.data?.data ?? [])
        .filter((d) => d.direction === direction && d.status !== 'PAID')
        .map((d) => d.personName.trim().toLocaleLowerCase('uz')),
    ).size;

  return (
    <WidgetCard title={t('nav.debts')} to="/app/debts">
      <WidgetState
        isLoading={stats.isLoading || debts.isLoading}
        isError={stats.isError || debts.isError}
        onRetry={() => {
          void stats.refetch();
          void debts.refetch();
        }}
        errorTitle={t('debts.page.loadFailed')}
        skeleton={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-11" />
            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-[72px]" />
              <Skeleton className="h-[72px]" />
            </div>
            <Skeleton className="h-10" />
          </div>
        }
      >
        {s && (
          <div className="flex flex-col gap-3">
            {s.overdueCount > 0 && (
              <Link
                to="/app/debts"
                className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] font-semibold leading-[18px] text-danger focus-ring"
              >
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{t('dashboard.widgets.debtsOverdue', { count: s.overdueCount })}</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: t('debts.owedToMe'), value: s.owedToMe, count: people('I_LENT'), colour: 'text-debt' },
                { label: t('debts.iOwe'), value: s.iOwe, count: people('I_BORROWED'), colour: 'text-text' },
              ].map((box) => (
                <div key={box.label} className="flex flex-col gap-0.5 rounded-[14px] border border-border bg-surface p-3">
                  <span className="text-[12px] text-text-muted">{box.label}</span>
                  <span className={`truncate text-[15px] font-semibold ${box.colour}`}>{formatAmount(box.value)}</span>
                  <span className="text-[12px] text-text-muted">{tn('dashboard.widgets.people', box.count)}</span>
                </div>
              ))}
            </div>
            {upcoming.length > 0 && (
              <div className="flex flex-col">
                <span className="pb-1 text-[12px] font-medium text-text-muted">{t('dashboard.widgets.upcoming')}</span>
                {upcoming.map((d) => (
                  <Link
                    key={d.id}
                    to={`/app/debts?debt=${d.id}`}
                    className="flex min-h-[52px] items-center gap-2.5 rounded-md focus-ring"
                  >
                    <Avatar name={d.personName} size={36} letters={2} tone={d.direction === 'I_LENT' ? 'debt' : 'neutral'} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-medium leading-5">{d.personName}</span>
                      <span className="truncate text-[12px] leading-4 text-text-muted">
                        {d.direction === 'I_LENT' ? t('debts.owedToMe') : t('debts.iOwe')} · {formatAmount(d.remainingAmount)}
                      </span>
                    </span>
                    {dueChip(d)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </WidgetState>
    </WidgetCard>
  );
}
