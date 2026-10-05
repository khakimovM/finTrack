import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck } from 'lucide-react';
import { TelegramLoginStartResponse } from '@fintrack/shared';
import { apiErrorToMessage } from '../../lib/apiError';
import { useAuthStore } from '../../stores/authStore';
import { LogoMark } from '../../components/brand/Logo';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { CodeForm, ErrorBanner, FinishedRow, StartButton, WaitingSteps } from '../../features/auth/components/LoginStates';
import { useSessionQuery } from '../../features/auth/hooks/useSession';
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

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);
  const session = useSessionQuery();

  const [request, setRequest] = useState<TelegramLoginStartResponse | null>(null);
  const [code, setCode] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
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

  // Already signed in (e.g. "Kirish" on the landing page with a live cookie): go straight in.
  if (session.data && !request) return <Navigate to="/app" replace />;

  const begin = async () => {
    setStartError(null);
    setCodeError(null);
    setCode('');
    try {
      const created = await start.mutateAsync();
      setRequest(created);
      // Opens the Telegram app (mobile) or Telegram Desktop; the page keeps polling meanwhile.
      window.open(created.deepLink, '_blank', 'noopener');
    } catch (err) {
      setStartError(apiErrorToMessage(err));
    }
  };

  const submit = async (value: string) => {
    if (!request || value.length !== 6 || verify.isPending) return;
    setCodeError(null);
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
      setCodeError(left !== undefined ? `Kod noto‘g‘ri. Yana ${left} ta urinish qoldi` : apiErrorToMessage(err));
      void status.refetch();
    }
  };

  const onResend = async () => {
    if (!request) return;
    setCodeError(null);
    setCode('');
    try {
      await resend.mutateAsync(request.requestId);
      void status.refetch();
    } catch (err) {
      setCodeError(apiErrorToMessage(err));
    }
  };

  const finished = state === 'CANCELLED' || state === 'EXPIRED';

  let body;
  if (!request || state === 'CONSUMED') {
    body = (
      <>
        {startError && <ErrorBanner message={startError} />}
        <StartButton onStart={() => void begin()} starting={start.isPending} />
      </>
    );
  } else if (finished) {
    body = <FinishedRow cancelled={state === 'CANCELLED'} onRestart={() => void begin()} restarting={start.isPending} />;
  } else if (state === 'CODE_SENT') {
    body = (
      <CodeForm
        code={code}
        onCodeChange={(next) => {
          setCode(next);
          if (codeError) setCodeError(null);
        }}
        onSubmit={(value) => void submit(value)}
        verifying={verify.isPending}
        codeError={codeError}
        secondsLeft={secondsLeft(status.data?.codeExpiresAt, now)}
        onResend={() => void onResend()}
        resending={resend.isPending}
      />
    );
  } else {
    body = (
      <WaitingSteps botUsername={request.botUsername} deepLink={request.deepLink} awaitingContact={state === 'AWAITING_CONTACT'} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      <PublicHeader back />
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-2xl border border-border bg-card px-5 pb-5 pt-6 shadow-sm sm:px-9 sm:pb-7 sm:pt-9">
          <div className="flex flex-col gap-3">
            <LogoMark size={48} />
            <h1 className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em]">FinTrack’ga kirish</h1>
            <p className="text-text-secondary">
              Parol shart emas: kirish kodi Telegram’dagi botimizga keladi. Birinchi marta kirsangiz, hisob avtomatik yaratiladi.
            </p>
          </div>
          {body}
          <p className="flex items-start gap-2.5 border-t border-border pt-[18px] text-[13px] leading-[18px] text-text-muted">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Kodni hech kimga bermang — FinTrack xodimlari uni hech qachon so‘ramaydi.
          </p>
        </div>
      </main>
    </div>
  );
}
