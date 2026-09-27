import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Laptop, LogOut, Send, Smartphone, Trash2 } from 'lucide-react';
import { DELETE_ACCOUNT_CONFIRMATION, SessionResponse, UserResponse } from '@fintrack/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { queryKeys } from '../../../lib/queryKeys';
import { useTelegramLoginStatus } from '../../auth/hooks/useTelegramLogin';
import {
  useDeleteAccount,
  useLinkTelegram,
  useLogoutAll,
  useRevokeSession,
  useSessions,
} from '../hooks/useSettings';

function deviceLabel(ua: string | null | undefined): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Nomaʼlum qurilma', mobile: false };
  const mobile = /Android|iPhone|iPad|Mobile/.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Brauzer';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { label: os ? `${browser}, ${os}` : browser, mobile };
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
      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>Kirish kodlari va bildirishnomalar shu hisobga keladi.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="font-semibold">
            <Send className="mr-2 inline h-4 w-4 text-primary" />
            {user.telegramUsername ? `@${user.telegramUsername}` : 'Ulangan'}
            {user.phone && <span className="ml-2 text-muted-foreground">{user.phone}</span>}
          </span>
          <Badge variant="success">Ulangan</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram</CardTitle>
        <CardDescription>
          Kirish faqat Telegram orqali ishlaydi. Profilingizni saqlab qolish uchun Telegram hisobingizni ulang.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          loading={link.isPending}
          onClick={async () => {
            const created = await link.mutateAsync();
            setRequestId(created.requestId);
            window.open(created.deepLink, '_blank', 'noopener');
          }}
        >
          <Send className="mr-2 h-4 w-4" /> Telegram’ni ulash
        </Button>
        {requestId && (
          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            Botda <b>Start</b> tugmasini bosing — ulanish avtomatik tasdiqlanadi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SessionsSection() {
  const navigate = useNavigate();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutAll = useLogoutAll();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faol sessiyalar</CardTitle>
        <CardDescription>Hisobingizga kirilgan qurilmalar. Tanimaganingizni darhol yakunlang.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        {sessions.isError && <ErrorState onRetry={() => void sessions.refetch()} />}
        {sessions.data?.map((s: SessionResponse) => {
          const device = deviceLabel(s.userAgent);
          const Icon = device.mobile ? Smartphone : Laptop;
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {device.label} {s.isCurrent && <Badge variant="secondary" className="ml-1">Shu qurilma</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.ipAddress ?? 'IP nomaʼlum'} · oxirgi faollik {format(parseISO(s.lastUsedAt), 'dd.MM.yyyy HH:mm')}
                  </p>
                </div>
              </div>
              {!s.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Sessiyani yakunlash"
                  loading={revoke.isPending && revoke.variables === s.id}
                  onClick={() => revoke.mutate(s.id)}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
        <Button
          variant="outline"
          className="w-full"
          loading={logoutAll.isPending}
          onClick={async () => {
            await logoutAll.mutateAsync();
            navigate('/login', { replace: true });
          }}
        >
          Barcha qurilmalardan chiqish
        </Button>
      </CardContent>
    </Card>
  );
}

export function DangerZoneSection() {
  const navigate = useNavigate();
  const remove = useDeleteAccount();
  const [confirm, setConfirm] = useState('');

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Akkauntni o‘chirish</CardTitle>
        <CardDescription>
          Barcha hisoblar, tranzaksiyalar, qarzlar va byudjetlar butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          label={`Tasdiqlash uchun “${DELETE_ACCOUNT_CONFIRMATION}” deb yozing`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
        <Button
          variant="destructive"
          disabled={confirm !== DELETE_ACCOUNT_CONFIRMATION}
          loading={remove.isPending}
          onClick={async () => {
            await remove.mutateAsync({ confirm: DELETE_ACCOUNT_CONFIRMATION });
            navigate('/login', { replace: true });
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Akkauntni butunlay o‘chirish
        </Button>
      </CardContent>
    </Card>
  );
}
