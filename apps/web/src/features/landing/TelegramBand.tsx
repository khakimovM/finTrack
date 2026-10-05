import type { ReactNode } from 'react';
import { Bell, CreditCard, ExternalLink, Mic, Send, Zap, type LucideIcon } from 'lucide-react';
import { MINUS, NBSP } from '../../lib/money';
import { BOT_URL } from './links';

const nb = (text: string) => text.replace(/ /g, NBSP);

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[85%] self-end rounded-[16px_16px_4px_16px] bg-[color-mix(in_oklab,var(--brand)_20%,var(--card))] px-3 py-[7px]">
      {children}
    </div>
  );
}

function BotBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`max-w-[92%] self-start rounded-[16px_16px_16px_4px] border border-border bg-card px-3 py-2 ${className ?? ''}`}>
      {children}
    </div>
  );
}

const WAVE = [6, 10, 14, 8, 16, 18, 12, 7, 14, 20, 16, 10, 6, 12, 17, 13, 8, 11, 15, 9, 6, 4];

interface BandCard {
  icon: LucideIcon;
  title: string;
  text: string;
  demo: ReactNode;
  demoClassName?: string;
}

const CARDS: BandCard[] = [
  {
    icon: Zap,
    title: 'Tez yozish',
    text: 'Odatdagidek yozing — bot summa, kategoriya va sanani o‘zi ajratib oladi.',
    demo: (
      <>
        <UserBubble>45k tushlik</UserBubble>
        <BotBubble>
          <b className="font-semibold">{nb('Chiqim · 45 000 so‘m')}</b> · 🍔 Oziq-ovqat
        </BotBubble>
        <UserBubble>kecha 1,2 mln ijara</UserBubble>
        <BotBubble>
          <b className="font-semibold">{nb('Chiqim · 1 200 000 so‘m')}</b> · 🏠 Uy-joy · Kecha
        </BotBubble>
      </>
    ),
  },
  {
    icon: Mic,
    title: 'Ovozli xabarlar',
    text: 'Gapiring — bot eshitib, qoralama tayyorlaydi. Siz faqat tasdiqlaysiz.',
    demo: (
      <>
        <div className="flex items-center gap-2.5 self-end rounded-[16px_16px_4px_16px] bg-[color-mix(in_oklab,var(--brand)_20%,var(--card))] py-[7px] pl-[7px] pr-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 4l15 8-15 8z" />
            </svg>
          </span>
          <span className="flex items-center gap-0.5" aria-hidden>
            {WAVE.map((h, i) => (
              <span key={i} className="w-[2.5px] rounded-[2px] bg-text-secondary" style={{ height: h }} />
            ))}
          </span>
          <span className="text-[12px]">0:03</span>
        </div>
        <BotBubble>🎙 Eshitdim: «tushlikka qirq besh ming»</BotBubble>
        <div className="flex min-w-[min(240px,100%)] flex-col gap-1 self-start">
          <BotBubble className="max-w-full">
            <b className="font-semibold">{nb('Chiqim · 45 000 so‘m')}</b>
            <br />
            <span className="text-[13px] text-text-secondary">Kategoriya: Oziq-ovqat › Tushlik</span>
          </BotBubble>
          <div className="grid grid-cols-2 gap-1 text-[13px]">
            <span className="flex h-8 items-center justify-center rounded-[10px] border border-border bg-card font-semibold">✅ Saqlash</span>
            <span className="flex h-8 items-center justify-center rounded-[10px] border border-border bg-card font-medium">❌ Bekor</span>
          </div>
        </div>
      </>
    ),
  },
  {
    icon: Bell,
    title: 'Kunlik xulosa va eslatmalar',
    text: 'Har kuni 21:00 da kun yakuni, byudjet limiti va qarz muddatlari haqida xabar.',
    demo: (
      <>
        <BotBubble className="flex min-w-[min(250px,100%)] flex-col gap-0.5 px-3 py-2.5">
          <span className="font-semibold">🌙 Kun yakuni · 21:00</span>
          <span className="flex justify-between gap-4 text-text-secondary">
            Chiqim <b className="font-semibold text-expense">{nb(`${MINUS}329 000 so‘m`)}</b>
          </span>
          <span className="flex justify-between gap-4 text-text-secondary">
            Kirim <b className="font-semibold text-text">{nb('0 so‘m')}</b>
          </span>
        </BotBubble>
        <BotBubble>
          ⚠️ Transport byudjeti <b className="font-semibold text-warning">86%</b> ishlatildi
        </BotBubble>
        <BotBubble>⏰ Ertaga Dilnoza Rahimovaga {nb('900 000 so‘m')} qaytarish muddati</BotBubble>
      </>
    ),
  },
  {
    icon: CreditCard,
    title: 'Mini App',
    text: 'Botdagi “Ilova” tugmasi FinTrack’ni to‘liq ko‘rinishda Telegram ichida ochadi.',
    demoClassName: 'gap-2.5 overflow-hidden px-4 pb-0 pt-4',
    demo: (
      <>
        <div className="mx-auto flex w-full max-w-[300px] flex-col gap-2.5 rounded-t-[20px] border border-b-0 border-border bg-card px-4 py-3.5 shadow-md">
          <span className="mx-auto h-1 w-8 rounded-full bg-input" />
          <span className="text-[12px] text-text-muted">Jami balans</span>
          <span className="text-[22px] font-semibold leading-7 tracking-[-0.02em]">
            {nb('43 050 000')}
            <span className="ml-1 text-[12px] font-medium tracking-normal text-text-muted">so‘m</span>
          </span>
          <span className="flex gap-1.5 text-[12px] font-medium">
            <span className="flex h-8 flex-1 items-center justify-center rounded-full bg-primary text-primary-foreground">Chiqim</span>
            <span className="flex h-8 flex-1 items-center justify-center rounded-full bg-secondary">Kirim</span>
            <span className="flex h-8 flex-1 items-center justify-center rounded-full bg-secondary">O‘tkazma</span>
          </span>
        </div>
        <div className="-mx-4 flex items-center gap-1.5 border-t border-border bg-card p-2">
          <span className="flex h-8 items-center rounded-full bg-brand px-3 text-[12px] font-semibold text-brand-foreground shadow-[0_0_0_3px_var(--card),0_0_0_5px_var(--brand)]">
            Ilova
          </span>
          <span className="flex h-8 flex-1 items-center rounded-full bg-surface px-3 text-[12.5px] text-text-muted">Xabar</span>
        </div>
      </>
    ),
  },
];

/** Four ways the bot helps, each with a small chat scene. */
export function TelegramBand() {
  return (
    <section className="pb-16 min-[820px]:pb-[clamp(64px,7vw,112px)]">
      <div className="mx-auto max-w-[1232px] px-4">
        <div className="flex flex-col gap-10 rounded-2xl border border-border bg-surface p-6 min-[820px]:p-[clamp(24px,4vw,56px)]">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div className="flex max-w-[640px] flex-col gap-3">
              <span className="flex items-center gap-2 text-[14px] font-medium text-brand">
                <Send className="h-4 w-4" aria-hidden /> @fintrack_cwa_bot
              </span>
              <h2 className="text-[clamp(30px,3vw,44px)] font-semibold leading-[1.12] tracking-[-0.03em] [text-wrap:balance]">
                Telegram ichida moliya
              </h2>
              <p className="text-[17px] leading-[26px] text-text-secondary">
                Ilovani ochmasdan yozing: bot xabaringizni tushunadi va saqlashdan oldin tasdiqlashingizni so‘raydi.
              </p>
            </div>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-input px-5 text-[15px] font-medium hover:bg-secondary focus-ring"
            >
              Botni ochish <ExternalLink className="h-[15px] w-[15px]" aria-hidden />
            </a>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,460px),1fr))] gap-4">
            {CARDS.map((card) => (
              <article key={card.title} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <card.icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[17px] font-semibold leading-6">{card.title}</h3>
                    <p className="text-text-secondary">{card.text}</p>
                  </div>
                </div>
                <div
                  aria-hidden
                  className={`flex min-h-[220px] flex-1 flex-col justify-end rounded-lg bg-surface text-[14px] ${card.demoClassName ?? 'gap-2 p-4'}`}
                >
                  {card.demo}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
