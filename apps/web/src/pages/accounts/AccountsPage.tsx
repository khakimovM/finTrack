import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArrowLeftRight, Info, Lock, Plus, Trash2, Wallet } from 'lucide-react';
import type { AccountResponse } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Tabs } from '../../components/ui/Tabs';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { useIsMobile } from '../../lib/useMediaQuery';
import { useSortable } from '../../lib/useSortable';
import { apiErrorCode, apiErrorToMessage } from '../../lib/apiError';
import { cn } from '../../lib/utils';
import { toast } from '../../stores/toastStore';
import { useFormStore } from '../../stores/formStore';
import { AccountCard, type AccountActions } from '../../features/accounts/components/AccountCard';
import { AccountModal } from '../../features/accounts/components/AccountModal';
import {
  useAccountsWithArchived,
  useDeleteAccount,
  useReorderAccounts,
  useToggleArchiveAccount,
  useUpdateAccount,
} from '../../features/accounts/hooks/useAccounts';
import { AccountsBanner, AccountsSkeleton, ReorderBar } from './AccountsPageParts';
import { t, tn } from '../../lib/i18n';

type Tab = 'active' | 'archived';

export function AccountsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const openForm = useFormStore((s) => s.open);
  const [confirmDialog, confirm] = useConfirm();
  const { data, isLoading, isError, refetch } = useAccountsWithArchived();
  const toggleArchive = useToggleArchiveAccount();
  const deleteAccount = useDeleteAccount();
  const reorder = useReorderAccounts();
  const makeDefault = useUpdateAccount({ silent: true });

  const [tab, setTab] = useState<Tab>('active');
  const [editing, setEditing] = useState<AccountResponse | null | undefined>(undefined);
  // The order being arranged; null outside reorder mode.
  const [draft, setDraft] = useState<string[] | null>(null);

  const all = data?.data ?? [];
  const active = all.filter((a) => a.archivedAt === null);
  const archived = all.filter((a) => a.archivedAt !== null);
  const sortable = useSortable(draft ?? active.map((a) => a.id), { onCommit: setDraft });
  const byId = new Map(all.map((a) => [a.id, a]));
  const shown =
    tab === 'archived'
      ? archived
      : draft
        ? sortable.order.map((id) => byId.get(id)).filter((a): a is AccountResponse => a !== undefined)
        : active;

  const lastActive = () =>
    confirm({
      title: t('accounts.confirm.lastActive'),
      description: t('accounts.confirm.lastActiveText'),
      confirmLabel: t('accounts.confirm.gotIt'),
      hasCancel: false,
      warning: true,
      icon: Info,
    });

  const archive = async (account: AccountResponse) => {
    if (active.length <= 1) return void lastActive();
    try {
      await toggleArchive.mutateAsync(account.id);
    } catch (err) {
      if (apiErrorCode(err) === 'LAST_ACCOUNT') void lastActive();
      else toast.error(apiErrorToMessage(err));
    }
  };

  const actions: AccountActions = {
    onOpen: (account) => navigate(`/app/transactions?accountId=${encodeURIComponent(account.id)}`),
    onEdit: (account) => setEditing(account),
    onMakeDefault: (account) =>
      makeDefault
        .mutateAsync({ id: account.id, data: { isDefault: true } })
        .then(() => toast.success(t('accounts.toast.madePrimary', { name: account.name })))
        .catch((err: unknown) => toast.error(apiErrorToMessage(err))),
    onArchive: async (account) => {
      if (active.length <= 1) return void lastActive();
      const ok = await confirm({
        title: t('accounts.confirm.archive'),
        description: t('accounts.confirm.archiveText'),
        confirmLabel: t('accounts.card.archiveAction'),
        icon: Archive,
      });
      if (ok) await archive(account);
    },
    onUnarchive: async (account) => {
      await toggleArchive.mutateAsync(account.id).catch((err: unknown) => toast.error(apiErrorToMessage(err)));
      if (archived.length <= 1) setTab('active');
    },
    onDelete: async (account) => {
      if (account.transactionCount > 0) {
        const isArchived = account.archivedAt !== null;
        const ok = await confirm({
          title: t('accounts.confirm.hasEntries'),
          description: tn(isArchived ? 'accounts.confirm.hasEntriesArchived' : 'accounts.confirm.hasEntriesActive', account.transactionCount, {
            name: account.name,
          }),
          confirmLabel: isArchived ? t('accounts.confirm.gotIt') : t('accounts.card.archiveAction'),
          hasCancel: !isArchived,
          warning: true,
          icon: Lock,
        });
        if (ok && !isArchived) await archive(account);
        return;
      }
      if (account.archivedAt === null && active.length <= 1) return void lastActive();
      const ok = await confirm({
        title: t('accounts.confirm.delete'),
        description: t('accounts.confirm.deleteText'),
        confirmLabel: t('common.delete'),
        destructive: true,
        icon: Trash2,
      });
      if (!ok) return;
      try {
        await deleteAccount.mutateAsync(account.id);
      } catch (err) {
        if (apiErrorCode(err) === 'LAST_ACCOUNT') void lastActive();
        // Someone added a transaction meanwhile: the history rule wins, the account stays.
        else toast.error(apiErrorToMessage(err));
      }
    },
  };

  const saveOrder = async () => {
    if (!draft) return;
    await reorder
      .mutateAsync({ items: draft.map((id, index) => ({ id, sortOrder: index + 1 })) })
      .then(() => setDraft(null))
      .catch(() => undefined);
  };

  const openNew = () => setEditing(null);
  const canTransfer = active.length >= 2;
  const transferButton = canTransfer && (
    <Button variant="outline" onClick={() => openForm({ kind: 'transfer' })}>
      <ArrowLeftRight className="h-4 w-4" aria-hidden />
      {t('common.transfer')}
    </Button>
  );
  const newButton = (
    <Button onClick={openNew}>
      <Plus className="h-[18px] w-[18px]" aria-hidden />
      {t('accounts.page.new')}
    </Button>
  );

  const list = shown.length > 0 && (
    <div
      className={cn(
        isMobile
          ? 'flex flex-col rounded-[20px] border border-border bg-card px-4'
          : 'grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4',
        // Not while reordering: a moved card would replay its entrance on every step of the drag.
        !draft && 'ft-stagger',
      )}
    >
      {shown.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          actions={actions}
          compact={isMobile}
          handle={draft && account.archivedAt === null ? sortable.handleProps(account.id) : undefined}
          dragging={sortable.dragId === account.id}
          sortProps={draft ? sortable.itemProps(account.id) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('nav.accounts')}
        subtitle={t('accounts.page.subtitle')}
        actions={
          <>
            {transferButton}
            {newButton}
          </>
        }
        mobileActionsLayout={canTransfer ? 'lead' : 'equal'}
        mobileActions={
          <>
            {transferButton}
            {newButton}
          </>
        }
      />

      <AccountsBanner total={data?.meta.totalBalance ?? '0'} activeCount={active.length} />

      <div className={cn('flex flex-wrap items-center gap-2', draft === null && 'max-sm:flex-nowrap')}>
        <Tabs
          aria-label={t('nav.accounts')}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setDraft(null);
          }}
          items={[
            { value: 'active', label: t('accounts.page.active'), count: active.length },
            { value: 'archived', label: t('accounts.page.archive'), count: archived.length },
          ]}
        />
        <span className="flex-1" />
        {tab === 'active' && !isLoading && !isError && (
          <ReorderBar
            reordering={draft !== null}
            canStart={active.length > 1}
            saving={reorder.isPending}
            onStart={() => setDraft(active.map((a) => a.id))}
            onCancel={() => setDraft(null)}
            onSave={() => void saveOrder()}
          />
        )}
      </div>

      {isLoading ? (
        <AccountsSkeleton compact={isMobile} />
      ) : isError ? (
        <ErrorState title={t('accounts.page.loadFailed')} onRetry={() => void refetch()} className="rounded-[20px] border border-border bg-card" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" aria-hidden />}
          title={tab === 'archived' ? t('accounts.page.archiveEmptyTitle') : t('accounts.page.emptyTitle')}
          description={tab === 'archived' ? t('accounts.page.archiveEmptyText') : t('accounts.page.emptyText')}
          action={tab === 'active' ? <Button onClick={openNew}>{t('accounts.page.openNew')}</Button> : undefined}
          className="rounded-[20px] border border-border bg-card"
        />
      ) : (
        list
      )}

      <AccountModal isOpen={editing !== undefined} onClose={() => setEditing(undefined)} initialAccount={editing ?? null} />
      {confirmDialog}
    </div>
  );
}
