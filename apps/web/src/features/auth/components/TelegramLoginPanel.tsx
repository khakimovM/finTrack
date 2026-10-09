import { useEffect, useState } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { TelegramLoginStartResponse } from '@fintrack/shared';
import { apiErrorToMessage } from '../../../lib/apiError';
import { TelegramLoginApi, useTelegramLoginStatus } from '../hooks/useTelegramLogin';
import { CodeForm, ErrorBanner, FinishedRow, StartButton, WaitingSteps } from './LoginStates';

function secondsLeft(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
}

export interface TelegramLoginPanelProps<Result> {
  api: TelegramLoginApi<Result>;
  /** The code was accepted; `result` is what the verify call returned. */
  onVerified: (result: Result) => void;
  /** The person pressed start: from here on the page should not redirect them away. */
  onStarted?: () => void;
  startLabel?: string;
}

/**
 * The whole Telegram code flow: open the bot, wait for it, type the code, resend or restart.
 * The user login page and the admin login page differ only in `api` and what happens after.
 */
export function TelegramLoginPanel<Result>({ api, onVerified, onStarted, startLabel }: TelegramLoginPanelProps<Result>) {
  const [request, setRequest] = useState<TelegramLoginStartResponse | null>(null);
  const [code, setCode] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const start = useMutation({ mutationFn: api.start });
  const verify = useMutation({ mutationFn: api.verify });
  const resend = useMutation({ mutationFn: api.resend });
  const status = useTelegramLoginStatus(request?.requestId ?? null, api.status);
  const state = status.data?.status;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const begin = async () => {
    setStartError(null);
    setCodeError(null);
    setCode('');
    onStarted?.();
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
      onVerified(await verify.mutateAsync({ requestId: request.requestId, code: value }));
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
  let phase: 'start' | 'finished' | 'code' | 'waiting';
  if (!request || state === 'CONSUMED') {
    phase = 'start';
    body = (
      <>
        {startError && <ErrorBanner message={startError} />}
        <StartButton onStart={() => void begin()} starting={start.isPending} label={startLabel} />
      </>
    );
  } else if (finished) {
    phase = 'finished';
    body = <FinishedRow cancelled={state === 'CANCELLED'} onRestart={() => void begin()} restarting={start.isPending} />;
  } else if (state === 'CODE_SENT') {
    phase = 'code';
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
    phase = 'waiting';
    body = (
      <WaitingSteps botUsername={request.botUsername} deepLink={request.deepLink} awaitingContact={state === 'AWAITING_CONTACT'} />
    );
  }

  return (
    // Keyed by phase: start → waiting → code each fade up in place of the last.
    <div key={phase} className="flex animate-ft-page-in flex-col gap-6">
      {body}
    </div>
  );
}
