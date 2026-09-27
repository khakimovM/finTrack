import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Loader2, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import { TelegramLoginStartResponse } from '@fintrack/shared';
import { apiErrorToMessage } from '../../lib/apiError';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { OtpInput } from '../../features/auth/components/OtpInput';
import {
  useResendTelegramCode,
  useStartTelegramLogin,
  useTelegramLoginStatus,
  useVerifyTelegramLogin,
} from '../../features/auth/hooks/useTelegramLogin';

function secondsLeft(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
}

function mmss(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);

  const [request, setRequest] = useState<TelegramLoginStartResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const start = useStartTelegramLogin();
  const verify = useVerifyTelegramLogin();
  const resend = useResendTelegramCode();
  const status = useTelegramLoginStatus(request?.requestId ?? null);
  const state = status.data?.status;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const begin = async () => {
    setError(null);
    setCode('');
    try {
      const created = await start.mutateAsync();
      setRequest(created);
      // Opens the Telegram app (mobile) or Telegram Desktop; the page keeps polling meanwhile.
      window.open(created.deepLink, '_blank', 'noopener');
    } catch (err) {
      setError(apiErrorToMessage(err));
    }
  };

  const submit = async (value = code) => {
    if (!request || value.length !== 6 || verify.isPending) return;
    setError(null);
    try {
      const user = await verify.mutateAsync({ requestId: request.requestId, code: value });
      signIn(user);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
    } catch (err) {
      setCode('');
      const details = axios.isAxiosError(err)
        ? (err.response?.data as { error?: { details?: { attemptsLeft?: number } } } | undefined)?.error?.details
        : undefined;
      const left = details?.attemptsLeft;
      setError(left !== undefined ? `Kod noto‘g‘ri. Yana ${left} ta urinish qoldi` : apiErrorToMessage(err));
      void status.refetch();
    }
  };

  const onResend = async () => {
    if (!request) return;
    setError(null);
    try {
      await resend.mutateAsync(request.requestId);
      void status.refetch();
    } catch (err) {
      setError(apiErrorToMessage(err));
    }
  };

  const finished = state === 'CANCELLED' || state === 'EXPIRED' || state === 'CONSUMED';
  const codeSeconds = secondsLeft(status.data?.codeExpiresAt, now);

  return (
    <Card className="border-border/60 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-extrabold tracking-tight">FinTrack’ga kirish</CardTitle>
        <CardDescription>
          Parol shart emas: kirish kodi Telegram’dagi botimizga keladi. Birinchi marta kirsangiz, hisob avtomatik
          yaratiladi.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-xs font-semibold text-destructive"
          >
            {error}
          </div>
        )}

        {!request || finished ? (
          <div className="space-y-3 text-center">
            {state === 'CANCELLED' && (
              <p className="text-sm text-muted-foreground">So‘rov Telegram’da rad etildi.</p>
            )}
            {state === 'EXPIRED' && (
              <p className="text-sm text-muted-foreground">So‘rov muddati tugadi. Qaytadan boshlang.</p>
            )}
            <Button className="h-12 w-full text-base" onClick={begin} loading={start.isPending}>
              {finished ? <RotateCcw className="mr-2 h-5 w-5" /> : <Send className="mr-2 h-5 w-5" />}
              {finished ? 'Qaytadan boshlash' : 'Telegram orqali kirish'}
            </Button>
          </div>
        ) : state === 'CODE_SENT' ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> Kod Telegram’ga yuborildi
            </div>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(value) => void submit(value)}
              disabled={verify.isPending}
              invalid={Boolean(error)}
            />
            <Button type="submit" className="h-11 w-full" loading={verify.isPending} disabled={code.length !== 6}>
              Tasdiqlash
            </Button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{codeSeconds > 0 ? `Kod ${mmss(codeSeconds)} amal qiladi` : 'Kod muddati tugadi'}</span>
              <button
                type="button"
                onClick={onResend}
                disabled={resend.isPending}
                className="font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Kodni qayta yuborish
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Telegram’da <b className="text-foreground">@{request.botUsername}</b> ochiladi.</li>
              <li>2. <b className="text-foreground">Start</b> tugmasini bosing (yangi bo‘lsangiz — raqamni ulashing).</li>
              <li>3. Bot yuborgan 6 xonali kodni shu yerga kiriting.</li>
            </ol>
            <a
              href={request.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold hover:bg-accent"
            >
              <Send className="mr-2 h-4 w-4 text-primary" /> Telegram’ni ochish
            </a>
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {state === 'AWAITING_CONTACT' ? 'Raqamingizni ulashishingiz kutilmoqda…' : 'Telegram’dan javob kutilmoqda…'}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
        <ShieldCheck className="mr-1.5 h-4 w-4 text-success" />
        Kodni hech kimga bermang — FinTrack xodimlari uni hech qachon so‘ramaydi.
      </CardFooter>
    </Card>
  );
}
