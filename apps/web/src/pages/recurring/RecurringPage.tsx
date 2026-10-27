import { useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { RecurringRuleResponse, todayLocalIso } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { formatAmount } from '../../lib/money';
import {
  useDeleteRecurringRule,
  usePauseRecurringRule,
  useRecurringRules,
  useRunNowRecurringRule,
} from '../../features/recurring/hooks/useRecurring';
import { RecurringRuleCard } from '../../features/recurring/components/RecurringRuleCard';
import { RecurringModal } from '../../features/recurring/components/RecurringModal';
import { ruleTitle } from '../../features/recurring/recurringLabels';
import { t } from '../../lib/i18n';

type Tab = 'active' | 'paused';
const CARD = 'rounded-[20px] border border-border bg-card';

export function RecurringPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [form, setForm] = useState<{ rule: RecurringRuleResponse | null } | null>(null);
  const [confirmDialog, confirm] = useConfirm();

  const { data: rules = [], isLoading, isError, refetch } = useRecurringRules();
  const runNow = useRunNowRecurringRule();
  const pause = usePauseRecurringRule();
  const deleteRule = useDeleteRecurringRule();
  const busy = runNow.isPending || pause.isPending || deleteRule.isPending;

  const active = rules.filter((r) => r.isActive);
  const paused = rules.filter((r) => !r.isActive);
  const shown = tab === 'active' ? active : paused;

  const handleRunNow = async (rule: RecurringRuleResponse) => {
    const sign = rule.type === 'INCOME' ? '+' : '-';
    // Run-now books today's payment; a schedule already past today stays where it is.
    const keepsNext = rule.nextRunAt > todayLocalIso();
    const ok = await confirm({
      title: t('recurring.confirm.runNow'),
      description: `${ruleTitle(rule)}: ${formatAmount(rule.amount, { sign })} — ${rule.account.name}.${keepsNext ? t('recurring.confirm.keepsNext') : ''}`,
      confirmLabel: t('recurring.confirm.runNowAction'),
      icon: Repeat,
    });
    if (ok) await runNow.mutateAsync(rule.id).catch(() => undefined);
  };

  const handleDelete = async (rule: RecurringRuleResponse) => {
    const ok = await confirm({
      title: t('recurring.confirm.delete'),
      description: t('recurring.confirm.deleteText'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) await deleteRule.mutateAsync(rule.id).catch(() => undefined);
  };

  const openNew = () => setForm({ rule: null });
  const newButton = (
    <Button onClick={openNew}>
      <Plus className="h-[18px] w-[18px]" aria-hidden />
      {t('recurring.page.new')}
    </Button>
  );

  let body;
  if (isLoading)
    body = (
      <div role="status" aria-label={t('transactions.page.loading')} className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-[20px]" />
        ))}
      </div>
    );
  else if (isError) body = <ErrorState title={t('recurring.page.loadFailed')} onRetry={() => void refetch()} className={CARD} />;
  else if (shown.length === 0)
    body = (
      <EmptyState
        icon={<Repeat className="h-6 w-6" aria-hidden />}
        title={tab === 'active' ? t('recurring.page.emptyActive') : t('recurring.page.emptyPaused')}
        description={tab === 'active' ? t('recurring.page.emptyText') : undefined}
        action={tab === 'active' ? <Button onClick={openNew}>{t('recurring.page.new')}</Button> : undefined}
        className={CARD}
      />
    );
  else
    body = (
      <div className="ft-stagger flex flex-col gap-2.5">
        {shown.map((rule) => (
          <RecurringRuleCard
            key={rule.id}
            rule={rule}
            busy={busy}
            onRunNow={(r) => void handleRunNow(r)}
            onToggleActive={(r) => pause.mutate({ id: r.id, isActive: !r.isActive })}
            onEdit={(r) => setForm({ rule: r })}
            onDelete={(r) => void handleDelete(r)}
          />
        ))}
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageHeader
        title={t('nav.recurring')}
        subtitle={t('recurring.page.subtitle')}
        actions={newButton}
        mobileActions={newButton}
      />
      <Tabs
        aria-label={t('recurring.page.rules')}
        value={tab}
        onChange={setTab}
        className="self-start"
        items={[
          { value: 'active', label: t('recurring.page.active'), count: active.length },
          { value: 'paused', label: t('recurring.page.paused'), count: paused.length },
        ]}
      />
      {body}
      <RecurringModal isOpen={form !== null} onClose={() => setForm(null)} rule={form?.rule ?? null} />
      {confirmDialog}
    </div>
  );
}
