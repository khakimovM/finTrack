import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Wallet } from 'lucide-react';
import { BudgetStatusItem, addMonths, formatIsoDate, parseIsoDate, todayLocalIso } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Progress, budgetTone } from '../../components/ui/Progress';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { formatMonth } from '../../lib/format';
import { formatAmount } from '../../lib/money';
import { useIsMobile } from '../../lib/useMediaQuery';
import { cn } from '../../lib/utils';
import { useCategories } from '../../features/categories/hooks/useCategories';
import { BudgetCard } from '../../features/budgets/components/BudgetCard';
import { BudgetModal } from '../../features/budgets/components/BudgetModal';
import { useBudgetsStatus, useDeleteBudget } from '../../features/budgets/hooks/useBudgets';
import { DebtsSkeleton } from '../debts/DebtsPageParts';

const CARD = 'rounded-[20px] border border-border bg-card';
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(month: string, by: number): string {
  return formatIsoDate(addMonths(parseIsoDate(`${month}-01`), by)).slice(0, 7);
}

function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="flex h-10 items-center gap-0.5 rounded-full border border-input bg-card px-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Oldingi oy"
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary focus-ring"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-[112px] whitespace-nowrap text-center text-[14px] font-semibold" aria-live="polite">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Keyingi oy"
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary focus-ring"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function Total({ label, tiyin, sub, className }: { label: string; tiyin: bigint | string; sub?: string; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] text-text-muted">{label}</span>
      <span className={cn('whitespace-nowrap text-[19px] font-semibold leading-[1.2] tracking-[-0.02em] tabular-nums sm:text-[28px]', className)}>
        {formatAmount(tiyin, { sign: 'negative', currency: false })}{' '}
        <span className="text-[13px] font-medium tracking-normal text-text-muted">so‘m</span>
      </span>
      {sub && <span className="text-[12.5px] text-text-muted">{sub}</span>}
    </div>
  );
}

export function BudgetsPage() {
  const isMobile = useIsMobile();
  const [confirmDialog, confirm] = useConfirm();
  const [params, setParams] = useSearchParams();
  const requested = params.get('month') ?? '';
  const month = MONTH.test(requested) ? requested : todayLocalIso().slice(0, 7);
  const setMonth = (next: string) => setParams(next === todayLocalIso().slice(0, 7) ? {} : { month: next }, { replace: true });

  const { data, isLoading, isError, refetch } = useBudgetsStatus(month);
  const { data: tree = [] } = useCategories();
  const deleteBudget = useDeleteBudget();
  const [form, setForm] = useState<{ edit: BudgetStatusItem | null } | null>(null);

  const budgets = data?.data ?? [];
  const totalLimit = BigInt(data?.meta.totalLimit ?? '0');
  const totalSpent = BigInt(data?.meta.totalSpent ?? '0');
  const percent = totalLimit > 0n ? Number((totalSpent * 1000n) / totalLimit) / 10 : 0;
  const left = totalLimit - totalSpent;
  const withChildren = new Set(tree.filter((c) => (c.children ?? []).length > 0).map((c) => c.id));

  const remove = async (budget: BudgetStatusItem) => {
    const ok = await confirm({
      title: `“${budget.category.name}” byudjeti o‘chirilsinmi?`,
      description: `${formatMonth(month)} uchun limit olib tashlanadi. Tranzaksiyalar o‘zgarmaydi.`,
      confirmLabel: 'O‘chirish',
      destructive: true,
    });
    if (ok) await deleteBudget.mutateAsync(budget.id).catch(() => undefined);
  };

  const openNew = () => setForm({ edit: null });
  const newButton = (
    <Button onClick={openNew} className={isMobile ? 'h-11 min-w-0 flex-1 gap-1.5 px-3' : undefined}>
      <Plus className="h-[18px] w-[18px]" aria-hidden />
      Byudjet belgilash
    </Button>
  );

  let body;
  if (isLoading) body = <DebtsSkeleton />;
  else if (isError) body = <ErrorState title="Byudjetlarni yuklab bo‘lmadi" onRetry={() => void refetch()} className={CARD} />;
  else if (budgets.length === 0)
    body = (
      <EmptyState
        icon={<Wallet className="h-6 w-6" aria-hidden />}
        title={`${formatMonth(month)} uchun byudjet yo‘q`}
        description="Kategoriya uchun oylik limit belgilang — 80% va 100% da ogohlantiramiz."
        action={<Button onClick={openNew}>Byudjet belgilash</Button>}
        className={CARD}
      />
    );
  else
    body = (
      <>
        <section aria-label="Oy bo‘yicha jami" className={cn(CARD, 'flex flex-col gap-4 px-4 py-5 sm:p-6')}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Total label="Jami limit" tiyin={totalLimit} className="max-sm:col-span-2" />
            <Total
              label="Sarflangan"
              tiyin={totalSpent}
              sub={`Limitdan ${Math.round(percent)}% sarflandi`}
              className={percent > 100 ? 'text-danger' : undefined}
            />
            <Total label="Qoldiq" tiyin={left} className={left < 0n ? 'text-danger' : 'text-success'} />
          </div>
          <Progress value={percent} size="lg" tone={budgetTone(percent)} aria-label={`Limitdan ${Math.round(percent)}% sarflandi`} />
        </section>
        <div className="ft-stagger grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              hasChildren={withChildren.has(budget.category.id)}
              onEdit={(edit) => setForm({ edit })}
              onDelete={(b) => void remove(b)}
            />
          ))}
        </div>
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Byudjetlar"
        subtitle="Kategoriyalar bo‘yicha oylik limitlar"
        actions={
          <>
            <MonthSwitcher month={month} onChange={setMonth} />
            {newButton}
          </>
        }
      />
      {isMobile && (
        <div className="flex items-center justify-between gap-2">
          <MonthSwitcher month={month} onChange={setMonth} />
          {newButton}
        </div>
      )}
      {body}
      <BudgetModal
        isOpen={form !== null}
        onClose={() => setForm(null)}
        month={month}
        existing={budgets}
        editItem={form?.edit ?? null}
      />
      {confirmDialog}
    </div>
  );
}

