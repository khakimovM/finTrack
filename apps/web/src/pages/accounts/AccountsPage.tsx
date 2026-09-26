import { useState } from 'react';
import { Plus, ArrowRightLeft, Wallet } from 'lucide-react';
import { AccountResponse } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Amount } from '../../components/ui/Amount';
import { AccountCard } from '../../features/accounts/components/AccountCard';
import { AccountModal } from '../../features/accounts/components/AccountModal';
import { TransferModal } from '../../features/accounts/components/TransferModal';
import { useAccounts, useArchiveAccount } from '../../features/accounts/hooks/useAccounts';

export function AccountsPage() {
  const { data, isLoading, isError, error, refetch } = useAccounts();
  const archiveAccount = useArchiveAccount();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountResponse | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  const accounts = data?.data ?? [];
  const totalBalance = data?.meta?.totalBalance ?? '0';

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setIsAccountModalOpen(true);
  };

  const handleOpenEdit = (account: AccountResponse) => {
    setEditingAccount(account);
    setIsAccountModalOpen(true);
  };

  const handleArchive = async (id: string) => {
    if (
      window.confirm(
        'Haqiqatan ham bu hisobni arxivlamoqchimisiz? Arxivlangan hisob tranzaksiyalar tarixida saqlanadi, ammo yangi amallar uchun ko‘rsatilmaydi.',
      )
    ) {
      await archiveAccount.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hisoblar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Barcha bank kartalari, naqd pullar va jamg‘armalar boshqaruvi
          </p>
        </div>

        <div className="flex items-center gap-2">
          {accounts.length >= 2 && (
            <Button
              variant="outline"
              onClick={() => setIsTransferModalOpen(true)}
              className="gap-2"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>O‘tkazma</span>
            </Button>
          )}

          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Yangi hisob</span>
          </Button>
        </div>
      </div>

      {/* Total Balance Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Barcha hisoblardagi jami balans
            </span>
            <div className="mt-1">
              <Amount value={totalBalance} showSign={false} className="text-2xl sm:text-3xl" />
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground sm:text-right">
          <p className="font-semibold text-foreground">
            Faol hisoblar: {accounts.length} ta
          </p>
          <p className="mt-0.5">Valyuta: UZS (O‘zbek so‘mi)</p>
        </div>
      </div>

      {/* States: Loading, Error, Empty, Success */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : 'Hisoblarni yuklab bo‘lmadi'}
          onRetry={() => refetch()}
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          title="Hisoblar mavjud emas"
          description="Moliyaviy amallaringizni boshlash uchun dastlabki bank kartangiz yoki naqd pul hamyoningizni qo‘shing."
          action={
            <Button onClick={handleOpenCreate}>Yangi hisob ochish</Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={handleOpenEdit}
              onArchive={handleArchive}
              isArchiving={archiveAccount.isPending}
            />
          ))}
        </div>
      )}

      {/* Account Modal (Create / Edit) */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
        }}
        initialAccount={editingAccount}
      />

      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />
    </div>
  );
}
