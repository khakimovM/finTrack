import type { ReactNode } from 'react';
import { ArrowUpRight, Check, Send, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useFormStore } from '../../../stores/formStore';
import { Button } from '../../../components/ui/Button';
import { BOT_URL } from '../../landing/links';

interface Step {
  title: string;
  hint: string;
  icon: LucideIcon;
  done: boolean;
  action: ReactNode;
}

/** A brand-new user's checklist: the dashboard has nothing to chart until these happen. */
export function FirstSteps({ hasAccount }: { hasAccount: boolean }) {
  const open = useFormStore((s) => s.open);
  const steps: Step[] = [
    {
      title: 'Hisob qo‘shing',
      hint: 'Karta, naqd pul yoki jamg‘arma',
      icon: Wallet,
      done: hasAccount,
      action: (
        <Button size="sm" onClick={() => open({ kind: 'account' })}>
          Hisob qo‘shish
        </Button>
      ),
    },
    {
      title: 'Birinchi chiqimni yozing',
      hint: 'Summa, kategoriya va hisob',
      icon: ArrowUpRight,
      done: false,
      action: (
        <Button size="sm" variant="outline" onClick={() => open({ kind: 'transaction', type: 'EXPENSE' })}>
          Chiqim yozish
        </Button>
      ),
    },
    {
      title: 'Telegram botni sinab ko‘ring',
      hint: '“45k tushlik” deb yozib ko‘ring',
      icon: Send,
      done: false,
      action: (
        <Button size="sm" variant="outline" asChild>
          <a href={BOT_URL} target="_blank" rel="noopener noreferrer">
            Botni ochish
          </a>
        </Button>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card px-4 py-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-semibold leading-7">Boshlash uchun uchta qadam</h2>
          <p className="text-text-secondary">Hisob qo‘shganingizdan keyin bu yerda balans, grafiklar va byudjetlar paydo bo‘ladi.</p>
        </div>
        <span className="flex h-7 shrink-0 items-center rounded-full bg-secondary px-2.5 text-[13px] font-semibold">
          {doneCount} / {steps.length}
        </span>
      </div>
      <ol className="flex flex-col divide-y divide-border">
        {steps.map((step) => (
          <li key={step.title} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                step.done ? 'bg-success text-primary-foreground' : 'border-[1.5px] border-input',
              )}
              aria-label={step.done ? 'Bajarildi' : 'Bajarilmagan'}
            >
              {step.done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
              <step.icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('font-semibold', step.done && 'text-text-muted line-through')}>{step.title}</span>
              <span className="text-[13px] leading-[18px] text-text-muted">{step.hint}</span>
            </span>
            {!step.done && <span className="ml-auto">{step.action}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
