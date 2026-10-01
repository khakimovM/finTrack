import { useState } from 'react';
import { PlusCircle, Repeat } from 'lucide-react';
import { RecurringRuleResponse, formatMoney } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { apiErrorToMessage } from '../../lib/apiError';
import { cn } from '../../lib/utils';
import {
  useDeleteRecurringRule,
  useRecurringRules,
  useRunNowRecurringRule,
  useUpdateRecurringRule,
} from '../../features/recurring/hooks/useRecurring';
import { RecurringRuleCard } from '../../features/recurring/components/RecurringRuleCard';
import { RecurringCreateModal } from '../../features/recurring/components/RecurringCreateModal';
import { RecurringEditModal } from '../../features/recurring/components/RecurringEditModal';

type Tab = 'active' | 'paused';

export function RecurringPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRuleResponse | null>(null);
  const [confirmDialog, confirm] = useConfirm();

  const {
    data: rules = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useRecurringRules(tab === 'active');
  const runNow = useRunNowRecurringRule();
  const updateRule = useUpdateRecurringRule();
  const deleteRule = useDeleteRecurringRule();
  const busy = runNow.isPending || updateRule.isPending || deleteRule.isPending;

  const handleRunNow = async (rule: RecurringRuleResponse) => {
    const confirmed = await confirm({
      title: 'Bugungi to‘lov hozir yozilsinmi?',
      description: `${formatMoney(rule.amount)} — ${rule.account.icon} ${rule.account.name}. Keyingi to‘lov jadval bo‘yicha davom etadi.`,
      confirmLabel: 'Yozish',
    });
    if (confirmed) await runNow.mutateAsync(rule.id);
  };

  const handleToggleActive = (rule: RecurringRuleResponse) =>
    updateRule.mutateAsync({ id: rule.id, data: { isActive: !rule.isActive } });

  const handleDelete = async (rule: RecurringRuleResponse) => {
    const confirmed = await confirm({
      title: 'Takroriy to‘lov o‘chirilsinmi?',
      description: 'Oldin yozilgan to‘lovlar tarixda qoladi, yangilari yozilmaydi.',
      confirmLabel: 'O‘chirish',
      destructive: true,
    });
    if (confirmed) await deleteRule.mutateAsync(rule.id);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            <Repeat className="h-7 w-7 text-primary" />
            Takroriy to‘lovlar
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Oylik, ijara, obuna kabi muntazam kirim va chiqimlar o‘z vaqtida avtomatik yoziladi
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <PlusCircle className="h-4 w-4" />
          Yangi qoida
        </Button>
      </div>

      <div
        className="inline-flex rounded-2xl border border-border/50 bg-muted/60 p-1"
        role="tablist"
      >
        {(
          [
            ['active', 'Faol'],
            ['paused', 'To‘xtatilgan'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'min-h-11 rounded-xl px-4 text-xs font-bold transition-all sm:min-h-9',
              tab === key
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={apiErrorToMessage(error)} onRetry={() => refetch()} />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-10 w-10 text-muted-foreground/60" />}
          title={tab === 'active' ? 'Faol takroriy to‘lovlar yo‘q' : 'To‘xtatilgan to‘lovlar yo‘q'}
          description={
            tab === 'active'
              ? 'Oylik maosh, ijara yoki obunani bir marta kiriting — keyin u har safar o‘zi yoziladi.'
              : 'To‘xtatilgan qoidalar shu yerda turadi va istalgan payt davom ettirilishi mumkin.'
          }
          action={
            tab === 'active' && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Birinchi qoidani qo‘shish
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <RecurringRuleCard
              key={rule.id}
              rule={rule}
              onRunNow={handleRunNow}
              onToggleActive={handleToggleActive}
              onEdit={setEditing}
              onDelete={handleDelete}
              busy={busy}
            />
          ))}
        </div>
      )}

      <RecurringCreateModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <RecurringEditModal rule={editing} onClose={() => setEditing(null)} />
      {confirmDialog}
    </div>
  );
}
