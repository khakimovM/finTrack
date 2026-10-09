import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminBanUserInput, AdminBanUserSchema } from '@fintrack/shared';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Textarea } from '../../../components/ui/Textarea';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { useAdminUser, useAdminUserAction } from '../hooks/useAdminData';
import { UserDetailBody } from './UserDetailBody';

interface UserDetailModalProps {
  userId: string | null;
  today: string;
  onClose: () => void;
}

/**
 * One person's card with the owner's three actions. Banning asks for a reason first (the person
 * reads it in the bot); unbanning and ending sessions ask for a plain confirmation.
 */
export function UserDetailModal({ userId, today, onClose }: UserDetailModalProps) {
  const detail = useAdminUser(userId);
  const action = useAdminUserAction();
  const [confirmDialog, confirm] = useConfirm();
  const [banning, setBanning] = useState(false);
  const form = useForm<AdminBanUserInput>({ resolver: zodResolver(AdminBanUserSchema), defaultValues: { reason: '' } });

  useInitOnOpen(userId !== null, true, () => {
    setBanning(false);
    form.reset({ reason: '' });
  });

  const data = detail.data;
  const user = data?.user;
  const busy = action.isPending;

  const ban = form.handleSubmit(async ({ reason }) => {
    if (!user) return;
    await action.mutateAsync({ kind: 'ban', id: user.id, reason }).catch(() => undefined);
    setBanning(false);
  });

  const unban = async () => {
    if (!user) return;
    const ok = await confirm({
      title: 'Blokdan chiqarilsinmi?',
      description: `${user.name} yana sayt, ilova va bot orqali kira oladi. Unga botda xabar boradi.`,
      confirmLabel: 'Blokdan chiqarish',
      icon: ShieldCheck,
    });
    if (ok) await action.mutateAsync({ kind: 'unban', id: user.id }).catch(() => undefined);
  };

  const revoke = async () => {
    if (!user) return;
    const ok = await confirm({
      title: 'Barcha sessiyalar tugatilsinmi?',
      description: `${user.name} hamma qurilmada tizimdan chiqadi, lekin qayta kira oladi.`,
      confirmLabel: 'Sessiyalarni tugatish',
      destructive: true,
      icon: LogOut,
    });
    if (ok) await action.mutateAsync({ kind: 'revoke', id: user.id }).catch(() => undefined);
  };

  const canAct = user && user.status !== 'deleted' && !user.isAdmin;

  const footer = banning ? (
    <>
      <Button variant="outline" onClick={() => setBanning(false)} disabled={busy}>
        Bekor qilish
      </Button>
      <Button variant="destructive" onClick={() => void ban()} loading={busy}>
        Bloklash
      </Button>
    </>
  ) : canAct ? (
    <>
      <Button variant="outline" onClick={() => void revoke()} disabled={busy || data.counts.activeSessions === 0}>
        Sessiyalarni tugatish
      </Button>
      {user.status === 'banned' ? (
        <Button onClick={() => void unban()} loading={busy}>
          Blokdan chiqarish
        </Button>
      ) : (
        <Button variant="destructive" onClick={() => setBanning(true)} disabled={busy}>
          Bloklash
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <>
      <Modal
        isOpen={userId !== null}
        onClose={onClose}
        size="lg"
        title={banning ? 'Foydalanuvchini bloklash' : 'Foydalanuvchi'}
        description={
          banning && user
            ? `${user.name} hech qayerdan kira olmaydi, barcha sessiyalari darhol tugaydi. Ma’lumotlari o‘chmaydi.`
            : undefined
        }
        footer={footer}
      >
        {detail.isLoading && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="h-[120px] w-full" />
            <Skeleton className="h-[140px] w-full" />
          </div>
        )}
        {detail.isError && (
          <ErrorState variant="widget" title="Ma’lumotni yuklab bo‘lmadi" onRetry={() => void detail.refetch()} />
        )}
        {data &&
          (banning ? (
            <form onSubmit={(e) => void ban(e)} className="flex flex-col gap-3 pb-1">
              <Textarea
                label="Sabab"
                hint="Foydalanuvchiga botda shu matn ko‘rsatiladi (3–300 belgi)."
                rows={4}
                maxLength={300}
                autoFocus
                error={form.formState.errors.reason ? 'Sababni 3 belgidan uzunroq yozing' : undefined}
                {...form.register('reason')}
              />
            </form>
          ) : (
            <>
              <UserDetailBody detail={data} today={today} />
              {user?.isAdmin && (
                <p className="mt-4 text-[13px] text-text-muted">Admin hisobini bloklab ham, sessiyalarini bu yerdan tugatib ham bo‘lmaydi.</p>
              )}
            </>
          ))}
      </Modal>
      {confirmDialog}
    </>
  );
}
