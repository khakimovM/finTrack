import * as React from 'react';
import { ArrowUpDown, ChartColumn, ChartPie, ChevronLeft, House, Lock, Mic, Plus, Repeat, Users, Wallet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LogoBars, LogoMark } from '../../components/brand/Logo';
import { formatAmountNumber, MINUS, NBSP } from '../../lib/money';
import { useCountUp, useReducedMotion } from '../../lib/motion';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useEntrance } from './reveal';

const nb = (text: string) => text.replace(/ /g, NBSP);
const tint = (n: number, amount = 16) => `color-mix(in oklab, var(--chart-${n}) ${amount}%, transparent)`;

const SIDE = [
  { label: 'Bosh sahifa', icon: House },
  { label: 'Tranzaksiyalar', icon: ArrowUpDown },
  { label: 'Hisoblar', icon: Wallet },
  { label: 'Byudjetlar', icon: ChartPie },
  { label: 'Qarzlar', icon: Users },
  { label: 'Takroriy', icon: Repeat },
  { label: 'Hisobotlar', icon: ChartColumn },
];

const BUDGETS = [
  { emoji: '🍔', name: 'Oziq-ovqat', pct: 56, tone: 'success', tint: tint(1) },
  { emoji: '🚗', name: 'Transport', pct: 86, tone: 'warning', tint: tint(3, 18) },
  { emoji: '🎬', name: 'Ko‘ngilochar', pct: 124, tone: 'danger', tint: tint(4) },
  { emoji: '🏠', name: 'Uy-joy', pct: 75, tone: 'success', tint: tint(2) },
] as const;

const TX = [
  { emoji: '🚕', name: 'Taksi', meta: 'Transport · Bugun', amount: `${MINUS}35 000`, colour: 'text-expense', tint: tint(3, 18) },
  { emoji: '🍔', name: 'Korzinka', meta: 'Oziq-ovqat · Kecha', amount: `${MINUS}284 000`, colour: 'text-expense', tint: tint(1) },
  { emoji: '💼', name: 'Oylik maosh', meta: 'Oylik · 5-okt', amount: '+8 500 000', colour: 'text-income', tint: tint(1) },
  { emoji: '⇄', name: 'Humo → Jamg‘arma', meta: 'O‘tkazma · 3-okt', amount: '1 000 000', colour: 'text-transfer', tint: tint(9) },
  { emoji: '🤝', name: 'Jasur Karimov', meta: 'Qarz berildi · 15-avg', amount: '2 000 000', colour: 'text-debt', tint: 'var(--debt-soft)' },
];

const BAR = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' } as const;
const PCT = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' } as const;

const KPI = [
  { label: 'Jami balans', som: 43_050_000, sign: '', colour: 'text-text' },
  { label: 'Kirim', som: 9_700_000, sign: '+', colour: 'text-income' },
  { label: 'Chiqim', som: 6_380_000, sign: MINUS, colour: 'text-expense' },
];

/**
 * Delays of the hero scene, which plays once on load in about three seconds (ms after mount):
 * browser 150 → figures count from 600 → budgets fill from 800 → rows from 850;
 * phone 450 → "50000 taksi" 1300 → bot typing 1650–2550 → draft 2450 → buttons 2650.
 * Its last frame is the static design, which is all reduced motion shows.
 */
type At = ReturnType<typeof useEntrance>;

/** A KPI figure counting up from zero; display only, the mock's numbers are made up. */
function CountingSom({ som, delayMs }: { som: number; delayMs: number }) {
  const shown = useCountUp(som, { durationMs: 1100, delayMs });
  return <>{formatAmountNumber(Math.round(shown) * 100)}</>;
}

/** The app's home screen in a browser frame, drawn at 880×580 and scaled with zoom on phones. */
function BrowserMock({ at }: { at: At }) {
  return (
    <div className="flex h-[580px] w-[880px] flex-col overflow-hidden rounded-lg border border-border bg-card text-[13px] leading-[18px] shadow-lg">
      <div className="flex h-10 shrink-0 items-center gap-3.5 border-b border-border bg-surface px-3.5">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-input" />
          ))}
        </span>
        <span className="mx-auto flex h-[26px] items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[12px] text-text-muted">
          <Lock className="h-[11px] w-[11px]" strokeWidth={2.4} /> FinTrack · Bosh sahifa
        </span>
        <span className="w-[42px]" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[172px_minmax(0,1fr)]">
        <div className="flex flex-col gap-0.5 border-r border-border bg-surface px-2.5 py-4">
          <span className="flex items-center gap-2 px-2 pb-4 text-[14px] font-semibold">
            <LogoMark size={22} /> FinTrack
          </span>
          {SIDE.map((item, i) => (
            <span
              key={item.label}
              className={cn(
                'flex h-8 items-center gap-[9px] rounded-[9px] px-2.5 text-[12.5px]',
                i === 0 ? 'bg-card font-semibold text-text shadow-xs' : 'font-medium text-text-secondary',
              )}
            >
              <item.icon className="h-[15px] w-[15px]" /> {item.label}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3.5 px-5 py-[18px]">
          <div className="flex items-center gap-2">
            <span className="mr-auto text-[18px] font-semibold leading-6 tracking-[-0.01em]">Oktabr 2026</span>
            <span className="flex h-7 items-center rounded-full border border-border px-3 text-[12px] font-medium">Shu oy</span>
            <span className="flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-[12px] font-medium text-primary-foreground">
              <Plus className="h-3 w-3" strokeWidth={2.5} /> Qo‘shish
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {KPI.map((kpi, i) => {
              const card = at(450 + i * 80, 'flex flex-col gap-1 rounded-[14px] border border-border px-3.5 py-3');
              return (
                <div key={kpi.label} className={card.className} style={card.style}>
                  <span className="text-[11.5px] text-text-secondary">{kpi.label}</span>
                  <span className={cn('whitespace-nowrap text-[19px] font-semibold leading-6 tracking-[-0.02em]', kpi.colour)}>
                    {kpi.sign}
                    <CountingSom som={kpi.som} delayMs={600 + i * 80} />
                    <span className="ml-1 text-[11px] font-medium tracking-normal text-text-muted">so‘m</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.25fr] gap-2.5">
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-border p-3.5">
              <span className="text-[13px] font-semibold">Byudjetlar</span>
              {BUDGETS.map((b, i) => {
                const fill = at(800 + i * 110, cn('block h-full origin-left rounded-[9px]', BAR[b.tone]), 'animate-ft-grow-x');
                return (
                  <div key={b.name} className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px]" style={{ background: b.tint }}>
                        {b.emoji}
                      </span>
                      <span className="flex-1 text-[12px] font-medium">{b.name}</span>
                      <span className={cn('text-[11.5px] font-semibold', PCT[b.tone])}>{b.pct}%</span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-[9px] bg-secondary">
                      <span className={fill.className} style={{ ...fill.style, width: `${Math.min(100, b.pct)}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col rounded-[14px] border border-border px-3.5 pb-1.5 pt-3.5">
              <span className="pb-1.5 text-[13px] font-semibold">So‘nggi tranzaksiyalar</span>
              {TX.map((t, i) => {
                const row = at(850 + i * 90, 'flex h-[46px] items-center gap-2.5');
                return (
                  <div key={t.name} className={row.className} style={row.style}>
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[14px]" style={{ background: t.tint }}>
                      {t.emoji}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[12.5px] font-medium">{t.name}</span>
                      <span className="text-[11px] leading-[14px] text-text-muted">{t.meta}</span>
                    </span>
                    <span className={cn('whitespace-nowrap text-[12.5px] font-semibold', t.colour)}>{nb(`${t.amount} so‘m`)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Three dots in a bot bubble, shown only while the bot "thinks" and drawn over the draft's spot. */
function Typing() {
  return (
    <span
      className="absolute left-0 top-0 flex h-[34px] animate-ft-blip items-center gap-1 rounded-[16px_16px_16px_4px] border border-border bg-card px-3.5"
      style={{ animationDelay: '1650ms' }}
    >
      {[0, 150, 300].map((offset) => (
        <span
          key={offset}
          className="h-1.5 w-1.5 animate-ft-typing rounded-full bg-text-secondary"
          style={{ animationDelay: `${1650 + offset}ms` }}
        />
      ))}
    </span>
  );
}

/** Telegram chat on a phone: "50000 taksi" and the bot's draft card with its inline buttons. */
function PhoneMock({ at, play }: { at: At; play: boolean }) {
  const day = at(1150, 'self-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary');
  const message = at(
    1300,
    'origin-bottom-right self-end rounded-[16px_16px_4px_16px] bg-[color-mix(in_oklab,var(--brand)_20%,var(--card))] py-1.5 pl-3 pr-2.5 text-[14px]',
    'animate-ft-zoom-in',
  );
  const draft = at(
    2450,
    'flex origin-bottom-left flex-col gap-[3px] rounded-[16px_16px_16px_4px] border border-border bg-card px-3 py-2.5',
    'animate-ft-zoom-in',
  );
  const buttons = at(2650, 'mr-6 grid grid-cols-2 gap-1');
  return (
    <div className="h-[572px] w-[280px] rounded-[46px] bg-[#151514] p-2 shadow-[var(--shadow-lg),inset_0_0_0_1px_rgba(255,255,255,.06)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[38px] bg-surface text-[13px] leading-[18px]">
        <div className="flex h-[34px] shrink-0 items-end justify-between px-[26px] pb-1 text-[12px] font-semibold">
          <span>9:41</span>
          <span className="-mb-0.5 h-5 w-16 rounded-full bg-[#151514]" />
          <span className="flex items-end gap-[2px]">
            {[5, 7, 9].map((h) => (
              <span key={h} className="w-[3px] rounded-[1px] bg-text" style={{ height: h }} />
            ))}
          </span>
        </div>
        <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-border bg-card px-3">
          <ChevronLeft className="h-4 w-4 text-text-secondary" strokeWidth={2.2} />
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-brand">
            <LogoBars size={17} />
          </span>
          <span className="flex flex-col">
            <span className="text-[13.5px] font-semibold">FinTrack</span>
            <span className="text-[11px] leading-[14px] text-text-muted">bot</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-2 px-2.5 py-3">
          <span className={day.className} style={day.style}>
            Bugun
          </span>
          <div className={message.className} style={message.style}>
            50000 taksi <span className="ml-1 text-[10px] leading-3 text-text-secondary">12:04 ✓✓</span>
          </div>
          {/* The draft keeps its place from the start, so nothing above it moves when it arrives. */}
          <div className="relative mr-6">
            {play && <Typing />}
            <div className={draft.className} style={draft.style}>
              <span className="text-[11px] font-semibold text-text-muted">Qoralama</span>
              <span className="text-[14.5px] font-semibold leading-5">{nb('Chiqim · 50 000 so‘m')}</span>
              <span className="text-[12.5px] text-text-secondary">Kategoriya: Transport › Taksi</span>
              <span className="text-[12.5px] text-text-secondary">Hisob: Humo karta</span>
              <span className="self-end text-[10px] text-text-muted">12:04</span>
            </div>
          </div>
          <div className={buttons.className} style={buttons.style}>
            <span className="col-span-2 flex h-[34px] items-center justify-center rounded-[10px] border border-border bg-card text-[12.5px] font-semibold">
              ✅ Saqlash
            </span>
            <span className="flex h-[34px] items-center justify-center rounded-[10px] border border-border bg-card text-[12px] font-medium">📁 Kategoriya</span>
            <span className="flex h-[34px] items-center justify-center rounded-[10px] border border-border bg-card text-[12px] font-medium">❌ Bekor</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-card px-2 pb-5 pt-2">
          <span className="flex h-8 items-center rounded-full bg-brand px-3 text-[12px] font-semibold text-brand-foreground">Ilova</span>
          <span className="flex h-8 flex-1 items-center rounded-full bg-surface px-3 text-[12.5px] text-text-muted">Xabar</span>
          <span className="flex h-8 w-8 items-center justify-center text-text-secondary">
            <Mic className="h-[17px] w-[17px]" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Height the desktop scene is drawn at; the phone's bottom edge sits at 668. */
const SCENE_HEIGHT = 660;

/**
 * From 820px the scene shrinks to the height the hero leaves it (one screen minus header and
 * padding), so short laptop screens see it whole; it never grows past its drawn size.
 */
function useSceneScale(box: React.RefObject<HTMLDivElement | null>): number {
  const wide = useMediaQuery('(min-width: 820px)');
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    const node = box.current;
    if (!wide || !node) {
      setScale(1);
      return;
    }
    const fit = () => {
      // No layout (jsdom, display: none): keep the drawn size rather than collapse to nothing.
      if (node.clientHeight > 0) setScale(Math.min(1, node.clientHeight / SCENE_HEIGHT));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [box, wide]);

  return wide ? scale : 1;
}

/** Browser bleeding off the right edge with the phone in front; scaled down below 820px. */
export function HeroVisual() {
  const at = useEntrance();
  const play = !useReducedMotion();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const scale = useSceneScale(boxRef);
  const browser = at(150, 'absolute left-0 top-0 [zoom:0.5] min-[820px]:left-[76px] min-[820px]:top-2.5 min-[820px]:[zoom:1]', 'animate-ft-slide-in');
  const phone = at(450, 'absolute right-2 top-[58px] [zoom:0.76] min-[820px]:-left-7 min-[820px]:right-auto min-[820px]:top-24 min-[820px]:[zoom:1]');
  return (
    <div
      ref={boxRef}
      role="img"
      aria-label="FinTrack bosh sahifasi va Telegram botda “50000 taksi” xabaridan tayyorlangan qoralama"
      className="relative h-[480px] min-w-0 flex-[1_1_560px] min-[820px]:h-[clamp(400px,calc(100svh-65px-2*var(--hero-pad,0px)),660px)]"
    >
      <div
        className="absolute inset-0 origin-top-left min-[820px]:bottom-auto min-[820px]:h-[660px]"
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        <div aria-hidden className={browser.className} style={browser.style}>
          <BrowserMock at={at} />
        </div>
        <div aria-hidden className={phone.className} style={phone.style && { ...phone.style, animationDuration: '900ms' }}>
          <PhoneMock at={at} play={play} />
        </div>
      </div>
    </div>
  );
}
