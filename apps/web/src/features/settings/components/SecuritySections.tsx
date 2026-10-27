import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Laptop, LoaderCircle, LogOut, Send, Smartphone, Trash2, TriangleAlert } from 'lucide-react';
import { DELETE_ACCOUNT_CONFIRMATION, SessionResponse, UserResponse } from '@fintrack/shared';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { formatDateTime } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { queryKeys } from '../../../lib/queryKeys';
import { isMiniAppSession } from '../../../lib/miniAppAuth';
import { useTelegramLoginStatus } from '../../auth/hooks/useTelegramLogin';
import { BOT_USERNAME } from '../../landing/links';
import { useDeleteAccount, useLinkTelegram, useLogoutAll, useRevokeSession, useSessions } from '../hooks/useSettings';
import { SettingsCard } from './ProfileSection';
import { t } from '../../../lib/i18n';

export function deviceLabel(ua: string | null | undefined): { label: string; mobile: boolean } {
  if (!ua) return { label: t('settings.sessions.unknownDevice'), mobile: false };
  const mobile = /Android|iPhone|iPad|Mobile/.test(ua);
  if (ua.startsWith('TelegramMiniApp')) return { label: t('settings.sessions.telegramApp'), mobile };
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : t('settings.sessions.browser');
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { label: os ? `${browser}, ${os}` : browser, mobile };
}

/** "84.54.**": enough to recognise a network, not to publish the address on screen. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return t('settings.sessions.unknownIp');
  const v4 = ip.replace(/^::ffff:/, '').split('.');
  if (v4.length === 4) return `IP ${v4[0]}.${v4[1]}.**`;
  return `IP ${ip.split(':').slice(0, 2).join(':')}:**`;
}

export function TelegramSection({ user }: { user: UserResponse }) {
  const queryClient = useQueryClient();
  const link = useLinkTelegram();
  const [requestId, setRequestId] = useState<string | null>(null);
  const status = useTelegramLoginStatus(requestId);

  useEffect(() => {
    if (status.data?.status === 'CONSUMED') {
      setRequestId(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    }
  }, [status.data?.status, queryClient]);

  if (user.telegramLinked) {
    return (
      <SettingsCard title="Telegram">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-info-soft text-info" aria-hidden>
            <Send className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-[1_1_180px] flex-col">
            <span className="font-semibold">{user.telegramUsername ? `@${user.telegramUsername}` : t('settings.telegram.account')}</span>
            {user.phone && <span className="text-[13px] text-text-muted">{user.phone}</span>}
          </div>
          <Chip tone="success" dot className="h-[26px] text-[12.5px] font-semibold">
            {t('settings.telegram.linked')}
          </Chip>
        </div>
        <p className="text-[13.5px] leading-[19px] text-text-secondary">{t('settings.telegram.linkedText')}</p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="Telegram">
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-text-secondary" aria-hidden>
          <Send className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col">
          <span className="font-semibold">{t('settings.telegram.notLinked')}</span>
          <span className="text-[13px] leading-[18px] text-text-muted">{t('settings.telegram.notLinkedText')}</span>
        </div>
        <Button
          loading={link.isPending}
          disabled={requestId !== null}
          onClick={async () => {
            const created = await link.mutateAsync();
            setRequestId(created.requestId);
            window.open(created.deepLink, '_blank', 'noopener');
          }}
        >
          {t('settings.telegram.link')}
        </Button>
      </div>
      {requestId && (
        <div role="status" className="flex min-h-11 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 text-[14px] text-text-secondary">
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          {t('settings.telegram.waiting', { bot: BOT_USERNAME })}
        </div>
      )}
    </SettingsCard>
  );
}

function SessionRow({ session, first, onEnd, ending }: { session: SessionResponse; first: boolean; onEnd: () => void; ending: boolean }) {
  const device = deviceLabel(session.userAgent);
  const Icon = device.mobile ? Smartphone : Laptop;
  const meta = [maskIp(session.ipAddress), session.isCurrent ? t('settings.sessions.activeNow') : t('settings.sessions.lastActive', { date: formatDateTime(session.lastUsedAt) })].join(' · ');
  return (
    <li className={cn('flex flex-wrap items-center gap-3 py-3', !first && 'border-t border-border')}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold">{device.label}</span>
          {session.isCurrent && (
            <Chip tone="success" size="sm" className="font-semibold">
              {t('settings.sessions.thisDevice')}
            </Chip>
          )}
        </span>
        <span className="text-[12.5px] leading-[17px] text-text-muted">{meta}</span>
      </div>
      {!session.isCurrent && (
        <Button variant="outline" size="sm" onClick={onEnd} loading={ending} className="hover:border-transparent hover:bg-danger-soft hover:text-danger">
          {t('settings.sessions.end')}
        </Button>
      )}
    </li>
  );
}

export function SessionsSection() {
  const navigate = useNavigate();
  const [confirmDialog, confirm] = useConfirm();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutAll = useLogoutAll();
  const list = sessions.data ?? [];
  const miniApp = isMiniAppSession();

  const endAll = async () => {
    const ok = await confirm({
      title: t('settings.sessions.endAllTitle'),
      // On the web this device is signed out too; inside Telegram the launch signs it back in.
      description: miniApp
        ? t('settings.sessions.endAllMiniApp')
        : t('settings.sessions.endAllWeb'),
      confirmLabel: t('nav.logout'),
      destructive: true,
      icon: LogOut,
    });
    if (!ok) return;
    const stayed = await logoutAll.mutateAsync().catch(() => true);
    if (!stayed) navigate('/login', { replace: true });
  };

  return (
    <SettingsCard title={t('settings.sessions.title')} description={t('settings.sessions.description')}>
      {sessions.isLoading ? (
        <div role="status" aria-label={t('transactions.page.loading')} className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-2.5 w-[65%]" />
              </div>
            </div>
          ))}
        </div>
      ) : sessions.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-danger-soft p-3.5">
          <TriangleAlert className="h-5 w-5 text-danger" aria-hidden />
          <span className="flex-[1_1_200px] text-[14px] font-medium">{t('settings.sessions.loadFailed')}</span>
          <Button variant="outline" size="sm" onClick={() => void sessions.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col">
            {list.map((s, i) => (
              <SessionRow
                key={s.id}
                session={s}
                first={i === 0}
                ending={revoke.isPending && revoke.variables === s.id}
                onEnd={() => revoke.mutate(s.id)}
              />
            ))}
          </ul>
          <Button
            variant="outline"
            onClick={() => void endAll()}
            disabled={list.length <= 1}
            loading={logoutAll.isPending}
            className="self-start text-danger hover:bg-danger-soft"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('settings.sessions.endAll')}
          </Button>
        </>
      )}
      {confirmDialog}
    </SettingsCard>
  );
}

/** Apostrophe look-alikes count: “O'CHIRISH” typed on any keyboard confirms. */
const normalise = (text: string) => text.trim().toUpperCase().replace(/['’ʻʼ`]/g, '‘');

export function DangerZoneSection() {
  const navigate = useNavigate();
  const [confirmDialog, confirm] = useConfirm();
  const remove = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const ok = normalise(typed) === DELETE_ACCOUNT_CONFIRMATION;

  const deleteAccount = async () => {
    const sure = await confirm({
      title: t('settings.danger.confirmTitle'),
      description: t('settings.danger.text'),
      confirmLabel: t('settings.danger.confirmLabel'),
      destructive: true,
    });
    if (!sure) return;
    await remove.mutateAsync({ confirm: DELETE_ACCOUNT_CONFIRMATION });
    navigate('/', { replace: true });
  };

  return (
    <SettingsCard title={t('settings.danger.title')} danger>
      <p className="-mt-2 text-pretty text-[14px] leading-5 text-text-secondary">
        {t('settings.danger.text')}
      </p>
      <Input
        label={t('settings.danger.typeToConfirm', { word: DELETE_ACCOUNT_CONFIRMATION })}
        placeholder={DELETE_ACCOUNT_CONFIRMATION}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className={cn('font-semibold tracking-[0.04em]', ok && 'border-danger')}
      />
      <Button variant="destructive" disabled={!ok} loading={remove.isPending} onClick={() => void deleteAccount()} className="h-11 self-start">
        <Trash2 className="h-4 w-4" aria-hidden />
        {t('settings.danger.button')}
      </Button>
      {confirmDialog}
    </SettingsCard>
  );
}

