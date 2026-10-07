import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, CircleX, Clock, LoaderCircle, RotateCcw, Send, TriangleAlert } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { OtpInput } from './OtpInput';

const big = 'h-14 w-full text-[16px] sm:h-14';

export function StartButton({ onStart, starting }: { onStart: () => void; starting: boolean }) {
  return (
    <Button className={cn(big, 'gap-2.5')} onClick={onStart} disabled={starting} aria-busy={starting || undefined}>
      {starting ? (
        <>
          <LoaderCircle className="h-5 w-5 animate-ft-spin" aria-hidden /> Ulanmoqda…
        </>
      ) : (
        <>
          <Send className="h-5 w-5" aria-hidden /> Telegram orqali kirish
        </>
      )}
    </Button>
  );
}

/** Start-phase problem (service down, rate limit): banner above the start button. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg bg-danger-soft px-4 py-3.5 text-danger">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex flex-col">
        <span className="text-[14px] font-semibold leading-5">{message}</span>
        <span className="text-[13px] leading-[18px] text-text-secondary">Birozdan so‘ng qayta urinib ko‘ring.</span>
      </div>
    </div>
  );
}

export function WaitingSteps({
  botUsername,
  deepLink,
  awaitingContact,
}: {
  botUsername: string;
  deepLink: string;
  awaitingContact: boolean;
}) {
  const steps: ReactNode[] = [
    <>
      Telegram’da <b className="font-semibold">@{botUsername}</b> ochiladi.
    </>,
    <>
      <b className="font-semibold">Start</b> tugmasini bosing (yangi bo‘lsangiz — raqamni ulashing).
    </>,
    <>Bot yuborgan 6 xonali kodni shu yerga kiriting.</>,
  ];
  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-3.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <a
        href={deepLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-input text-[15px] font-medium transition-colors duration-fast hover:bg-secondary focus-ring"
      >
        <Send className="h-[18px] w-[18px]" aria-hidden /> Telegram’ni ochish
      </a>
      <p role="status" className="flex min-h-11 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 text-[14px] text-text-secondary">
        <LoaderCircle className="h-4 w-4 animate-ft-spin" strokeWidth={2.2} aria-hidden />
        {awaitingContact ? 'Raqamingizni ulashishingiz kutilmoqda…' : 'Telegram’dan javob kutilmoqda…'}
      </p>
    </div>
  );
}

function mmss(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Codes live 3 minutes; resend opens 60 seconds after a code was sent. */
const RESEND_AFTER_SECONDS = 120;

export interface CodeFormProps {
  code: string;
  onCodeChange: (code: string) => void;
  onSubmit: (code: string) => void;
  verifying: boolean;
  codeError: string | null;
  secondsLeft: number;
  onResend: () => void;
  resending: boolean;
}

export function CodeForm({ code, onCodeChange, onSubmit, verifying, codeError, secondsLeft, onResend, resending }: CodeFormProps) {
  const expired = secondsLeft <= 0;
  const cooldown = Math.max(0, secondsLeft - RESEND_AFTER_SECONDS);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
    >
      {expired ? (
        <p role="status" className="flex items-center gap-2 rounded-[14px] bg-warning-soft px-3.5 py-3 text-[14px] font-medium text-warning">
          <Clock className="h-[18px] w-[18px]" aria-hidden /> Kod muddati tugadi
        </p>
      ) : (
        <p role="status" className="flex items-center gap-2 text-[14px] font-medium text-success">
          <CircleCheck className="h-[18px] w-[18px] animate-ft-check-in" aria-hidden /> Kod Telegram’ga yuborildi
        </p>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-text-secondary">Tasdiqlash kodi</span>
        <OtpInput
          value={expired ? '' : code}
          onChange={onCodeChange}
          onComplete={onSubmit}
          disabled={verifying || expired}
          invalid={Boolean(codeError)}
        />
        {codeError && (
          <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium leading-[18px] text-danger">
            <CircleAlert className="h-[15px] w-[15px]" aria-hidden />
            {codeError}
          </p>
        )}
      </div>
      {expired ? (
        <Button type="button" className="h-[52px] w-full text-[15px] sm:h-[52px]" onClick={onResend} loading={resending}>
          <RotateCcw className="h-[18px] w-[18px]" aria-hidden /> Kodni qayta yuborish
        </Button>
      ) : (
        <>
          <Button type="submit" className="h-[52px] w-full text-[15px] sm:h-[52px]" disabled={code.length !== 6 || verifying}>
            {verifying ? (
              <>
                <LoaderCircle className="h-[18px] w-[18px] animate-ft-spin" aria-hidden /> Tekshirilmoqda…
              </>
            ) : (
              'Tasdiqlash'
            )}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden /> Kod {mmss(secondsLeft)} amal qiladi
            </span>
            <button
              type="button"
              onClick={onResend}
              disabled={cooldown > 0 || resending}
              className={cn(
                'h-9 rounded-sm px-1 text-[13px] font-medium focus-ring',
                cooldown > 0 ? 'text-text-muted' : 'text-text underline decoration-input underline-offset-[3px] hover:decoration-text',
              )}
            >
              {cooldown > 0 ? `Qayta yuborish · ${mmss(cooldown)}` : 'Kodni qayta yuborish'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

/** Request over: cancelled in Telegram or timed out. */
export function FinishedRow({ cancelled, onRestart, restarting }: { cancelled: boolean; onRestart: () => void; restarting: boolean }) {
  const Icon = cancelled ? CircleX : Clock;
  return (
    <div className="flex flex-col gap-5">
      <div role="alert" className="flex items-center gap-3.5 rounded-lg border border-border bg-surface p-4">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
            cancelled ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-[15px] font-medium leading-[22px]">
          {cancelled ? 'So‘rov Telegram’da rad etildi.' : 'So‘rov muddati tugadi. Qaytadan boshlang.'}
        </span>
      </div>
      <Button className="h-[52px] w-full text-[15px] sm:h-[52px]" onClick={onRestart} loading={restarting}>
        <RotateCcw className="h-[18px] w-[18px]" aria-hidden /> Qaytadan boshlash
      </Button>
    </div>
  );
}
