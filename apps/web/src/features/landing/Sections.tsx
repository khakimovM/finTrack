import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpDown,
  ChartColumn,
  ChartPie,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Lock,
  Monitor,
  Repeat,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LogoMark } from '../../components/brand/Logo';
import { BOT_URL } from './links';

const container = 'mx-auto max-w-[1232px] px-4';
const h2 = 'text-[clamp(30px,3vw,44px)] font-semibold leading-[1.12] tracking-[-0.03em] [text-wrap:balance]';
const eyebrow = 'text-[14px] font-medium text-brand';

/** The two calls to action used in the hero and the final band. */
export function CtaButtons({ center = false }: { center?: boolean }) {
  return (
    <div className={cn('flex flex-wrap gap-3', center && 'justify-center')}>
      <Link
        to="/login"
        className="inline-flex h-[52px] items-center gap-2.5 rounded-full bg-primary px-6 text-[16px] font-medium text-primary-foreground transition-colors duration-fast hover:bg-primary-hover focus-ring"
      >
        <Send className="h-[18px] w-[18px]" aria-hidden />
        Telegram orqali boshlash
      </Link>
      <a
        href={BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-[52px] items-center gap-2.5 rounded-full border border-input px-[22px] text-[16px] font-medium transition-colors duration-fast hover:bg-secondary focus-ring"
      >
        Botni ochish
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}

const FEATURES = [
  { icon: ArrowUpDown, title: 'Kirim va chiqimlar', text: 'Har bir so‘m o‘z kategoriyasida.' },
  { icon: Wallet, title: 'Hisoblar va o‘tkazmalar', text: 'Karta, naqd pul va jamg‘arma bir joyda.' },
  { icon: ChartPie, title: 'Byudjetlar', text: 'Limitning 80% va 100% ida ogohlantirish.' },
  { icon: Users, title: 'Qarzlar', text: 'Kim kimga qarzdor, qisman to‘lovlar va muddatlar.' },
  { icon: Repeat, title: 'Takroriy to‘lovlar', text: 'Oylik, ijara va obunalar o‘zi yoziladi.' },
  { icon: ChartColumn, title: 'Hisobotlar', text: 'Davrlarni solishtirish, CSV va Excel eksport.' },
];

export function Features() {
  return (
    <section id="imkoniyatlar" className="scroll-mt-16 border-t border-border py-16 min-[820px]:py-[clamp(64px,7vw,112px)]">
      <div className={cn(container, 'flex flex-col gap-10')}>
        <div className="flex max-w-[640px] flex-col gap-3">
          <span className={eyebrow}>Imkoniyatlar</span>
          <h2 className={h2}>Kundalik moliya uchun kerak bo‘lgan hammasi</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
          {FEATURES.map((f) => (
            <article key={f.title} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-[18px] font-semibold leading-6 tracking-[-0.01em]">{f.title}</h3>
                <p className="text-text-secondary">{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: 'Telegram orqali kiring', text: 'Bot sizga bir martalik kod yuboradi. Parol o‘ylab topish shart emas.' },
  { title: 'Hisoblaringizni qo‘shing', text: 'Karta, naqd pul va jamg‘armani boshlang‘ich balansi bilan kiriting.' },
  { title: 'Saytda, botda yoki ovoz bilan yozib boring', text: 'Qayerda qulay bo‘lsa, o‘sha yerda yozing — hammasi bir joyga tushadi.' },
];

export function Steps() {
  return (
    <section id="qanday-ishlaydi" className="scroll-mt-16 border-t border-border py-16 min-[820px]:py-[clamp(64px,7vw,112px)]">
      <div className={cn(container, 'flex flex-col gap-10')}>
        <div className="flex max-w-[640px] flex-col gap-3">
          <span className={eyebrow}>Qanday ishlaydi</span>
          <h2 className={h2}>Uch qadamda boshlang</h2>
        </div>
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-5 border-t-2 border-text pt-6">
              <span className="text-[15px] font-semibold text-text-muted">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex flex-col gap-2">
                <h3 className="text-[22px] font-semibold leading-7 tracking-[-0.01em]">{step.title}</h3>
                <p className="text-text-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const SECURITY = [
  { icon: KeyRound, title: 'Parolsiz kirish' },
  { icon: Smartphone, title: 'Kod faqat sizning Telegram’ingizga keladi' },
  { icon: Monitor, title: 'Faol sessiyalarni ko‘rish va yakunlash' },
  { icon: Lock, title: 'Maʼlumotlaringiz faqat sizga ko‘rinadi' },
];

/** Inverted band: near-black in light mode, near-white in dark. */
export function SecurityBand() {
  const muted = 'color-mix(in oklab, var(--primary-foreground) 72%, var(--primary))';
  return (
    <section className="pb-16 min-[820px]:pb-[clamp(64px,7vw,112px)]">
      <div className={container}>
        <div className="flex flex-wrap gap-x-16 gap-y-10 rounded-2xl bg-primary p-7 text-primary-foreground min-[820px]:p-[clamp(28px,4.5vw,64px)]">
          <div className="flex flex-[1_1_320px] flex-col gap-4">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-[14px]"
              style={{ background: 'color-mix(in oklab, var(--primary-foreground) 12%, var(--primary))' }}
            >
              <ShieldCheck className="h-[22px] w-[22px]" aria-hidden />
            </span>
            <h2 className={h2}>Xavfsiz, chunki parol yo‘q</h2>
            <p className="max-w-[420px] text-[17px] leading-[26px]" style={{ color: muted }}>
              Kirish Telegram hisobingizga bog‘langan. O‘g‘irlanadigan yoki unutiladigan parol yo‘q.
            </p>
          </div>
          <ul className="grid flex-[1.4_1_420px] grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-x-8 gap-y-7">
            {SECURITY.map((item) => (
              <li
                key={item.title}
                className="flex flex-col gap-3 border-t pt-5"
                style={{ borderColor: 'color-mix(in oklab, var(--primary-foreground) 18%, var(--primary))' }}
              >
                <item.icon className="h-[22px] w-[22px]" aria-hidden />
                <span className="text-[17px] font-semibold leading-6">{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  { q: 'Telegram’siz foydalansa bo‘ladimi?', a: 'Yo‘q. Kirish faqat Telegram orqali: kirish kodi botimizga keladi, parol kerak emas.' },
  {
    q: 'Ovozli xabarni qanday yuboraman?',
    a: 'Botda mikrofon tugmasini bosib turing va nimaga qancha sarflaganingizni ayting, masalan «tushlikka qirq besh ming». Bot qoralama tayyorlaydi — siz uni tasdiqlaysiz yoki tuzatasiz.',
  },
  { q: 'Maʼlumotlarimni yuklab olsam bo‘ladimi?', a: 'Ha. Hisobotlar bo‘limida istalgan davr uchun CSV yoki Excel faylini yuklab olishingiz mumkin.' },
  { q: 'Qarz berish xarajat hisoblanadimi?', a: 'Yo‘q. Qarz berganingizda hisob balansi o‘zgaradi, lekin bu summa xarajat statistikasiga kirmaydi.' },
  { q: 'Bir nechta karta qo‘shsam bo‘ladimi?', a: 'Ha. Har bir karta, naqd pul va jamg‘arma alohida hisob bo‘ladi, ular orasida o‘tkazma qilish mumkin.' },
];

/** Single-open accordion; the first answer starts open. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="savollar" className="scroll-mt-16 pb-16 min-[820px]:pb-[clamp(64px,7vw,112px)]">
      <div className={cn(container, 'flex flex-wrap gap-x-16 gap-y-8')}>
        <div className="flex flex-[1_1_300px] flex-col gap-3">
          <span className={eyebrow}>Savollar</span>
          <h2 className={h2}>Ko‘p beriladigan savollar</h2>
        </div>
        <div className="flex-[2_1_520px] border-t border-border">
          {FAQ.map((item, i) => {
            const expanded = open === i;
            const panelId = `faq-${i}`;
            return (
              <div key={item.q} className="border-b border-border">
                <h3>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? null : i)}
                    className="flex min-h-[68px] w-full items-center gap-4 py-[18px] text-left text-[17px] font-semibold leading-6 focus-ring"
                  >
                    <span className="flex-1">{item.q}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform duration-base ease-standard', expanded && 'rotate-180')}
                        aria-hidden
                      />
                    </span>
                  </button>
                </h3>
                <div id={panelId} hidden={!expanded} className="pb-[22px] pr-12 text-[15px] leading-6 text-text-secondary">
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="pb-12 min-[820px]:pb-[clamp(48px,6vw,96px)]">
      <div className={container}>
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-5 py-8 text-center min-[820px]:px-[clamp(20px,4vw,48px)] min-[820px]:py-[clamp(32px,6vw,88px)]">
          <LogoMark size={56} />
          <h2 className="max-w-[680px] text-[clamp(30px,3.4vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em] [text-wrap:balance]">
            Bugundan boshlab har bir so‘mni ko‘ring
          </h2>
          <p className="max-w-[480px] text-[17px] leading-[26px] text-text-secondary">
            Kirish uchun faqat Telegram kerak. Birinchi kirishda hisob o‘zi yaratiladi.
          </p>
          <CtaButtons center />
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1232px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 pb-8 pt-6">
        <span className="flex items-center gap-2.5 text-[14px] text-text-muted">
          <LogoMark size={24} /> © 2026 FinTrack
        </span>
        <nav className="flex gap-6 text-[14px] font-medium text-text-secondary" aria-label="Pastki havolalar">
          <Link to="/login" className="hover:text-text focus-ring">
            Kirish
          </Link>
          <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-text focus-ring">
            Telegram bot
          </a>
        </nav>
      </div>
    </footer>
  );
}
