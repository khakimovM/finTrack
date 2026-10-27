import * as React from 'react';
import { ArrowUpDown, ChartColumn, ChartPie, House, Lock, Plus, Repeat, Users, Wallet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LogoMark } from '../../components/brand/Logo';
import { currencyWord, formatAmountNumber, MINUS, NBSP } from '../../lib/money';
import { t, type TextKey } from '../../lib/i18n';
import { useCountUp, useReducedMotion } from '../../lib/motion';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useEntrance, type Entrance } from './reveal';
import { PhoneMock } from './HeroPhone';

const nb = (text: string) => text.replace(/ /g, NBSP);
const tint = (n: number, amount = 16) => `color-mix(in oklab, var(--chart-${n}) ${amount}%, transparent)`;

const SIDE: ReadonlyArray<{ label: TextKey; icon: typeof House }> = [
  { label: 'nav.home', icon: House },
  { label: 'nav.transactions', icon: ArrowUpDown },
  { label: 'nav.accounts', icon: Wallet },
  { label: 'nav.budgets', icon: ChartPie },
  { label: 'nav.debts', icon: Users },
  { label: 'landing.mock.recurring', icon: Repeat },
  { label: 'nav.reports', icon: ChartColumn },
];

const BUDGETS: ReadonlyArray<{ emoji: string; name: TextKey; pct: number; tone: 'success' | 'warning' | 'danger'; tint: string }> = [
  { emoji: '🍔', name: 'landing.mock.food', pct: 56, tone: 'success', tint: tint(1) },
  { emoji: '🚗', name: 'landing.mock.transport', pct: 86, tone: 'warning', tint: tint(3, 18) },
  { emoji: '🎬', name: 'landing.mock.fun', pct: 124, tone: 'danger', tint: tint(4) },
  { emoji: '🏠', name: 'landing.mock.housing', pct: 75, tone: 'success', tint: tint(2) },
];

const TX: ReadonlyArray<{ emoji: string; name: TextKey; meta: TextKey; amount: string; colour: string; tint: string }> = [
  { emoji: '🚕', name: 'landing.mock.taxi', meta: 'landing.mock.taxiMeta', amount: `${MINUS}35 000`, colour: 'text-expense', tint: tint(3, 18) },
  { emoji: '🍔', name: 'landing.mock.shop', meta: 'landing.mock.shopMeta', amount: `${MINUS}284 000`, colour: 'text-expense', tint: tint(1) },
  { emoji: '💼', name: 'landing.mock.salary', meta: 'landing.mock.salaryMeta', amount: '+8 500 000', colour: 'text-income', tint: tint(1) },
  { emoji: '⇄', name: 'landing.mock.transfer', meta: 'landing.mock.transferMeta', amount: '1 000 000', colour: 'text-transfer', tint: tint(9) },
  { emoji: '🤝', name: 'landing.mock.lent', meta: 'landing.mock.lentMeta', amount: '2 000 000', colour: 'text-debt', tint: 'var(--debt-soft)' },
];

const BAR = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' } as const;
const PCT = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' } as const;

const KPI: ReadonlyArray<{ label: TextKey; som: number; sign: string; colour: string }> = [
  { label: 'landing.mock.balance', som: 43_050_000, sign: '', colour: 'text-text' },
  { label: 'landing.mock.income', som: 9_700_000, sign: '+', colour: 'text-income' },
  { label: 'landing.mock.expense', som: 6_380_000, sign: MINUS, colour: 'text-expense' },
];

/**
 * Delays of the hero scene, which plays once on load in about three seconds (ms after mount):
 * browser 150 → figures count from 600 → budgets fill from 800 → rows from 850;
 * phone 450 → "50000 taksi" 1300 → bot typing 1650–2550 → draft 2450 → buttons 2650.
 * Its last frame is the static design, which is all reduced motion shows.
 */
type At = Entrance;

/** A KPI figure counting up from zero; display only, the mock's numbers are made up. */
function CountingSom({ som, delayMs }: { som: number; delayMs: number }) {
  const shown = useCountUp(som, { durationMs: 1100, delayMs });
  return <>{formatAmountNumber(Math.round(shown) * 100)}</>;
}

/** The app's home screen in a browser frame, drawn at 880×580 and scaled down on phones. */
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
          <Lock className="h-[11px] w-[11px]" strokeWidth={2.4} /> {t('landing.mock.tab')}
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
              <item.icon className="h-[15px] w-[15px]" /> {t(item.label)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3.5 px-5 py-[18px]">
          <div className="flex items-center gap-2">
            <span className="mr-auto text-[18px] font-semibold leading-6 tracking-[-0.01em]">{t('landing.mock.month')}</span>
            <span className="flex h-7 items-center rounded-full border border-border px-3 text-[12px] font-medium">{t('landing.mock.thisMonth')}</span>
            <span className="flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-[12px] font-medium text-primary-foreground">
              <Plus className="h-3 w-3" strokeWidth={2.5} /> {t('landing.mock.add')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {KPI.map((kpi, i) => {
              const card = at(450 + i * 80, 'flex flex-col gap-1 rounded-[14px] border border-border px-3.5 py-3');
              return (
                <div key={kpi.label} className={card.className} style={card.style}>
                  <span className="text-[11.5px] text-text-secondary">{t(kpi.label)}</span>
                  <span className={cn('whitespace-nowrap text-[19px] font-semibold leading-6 tracking-[-0.02em]', kpi.colour)}>
                    {kpi.sign}
                    <CountingSom som={kpi.som} delayMs={600 + i * 80} />
                    <span className="ml-1 text-[11px] font-medium tracking-normal text-text-muted">{currencyWord()}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.25fr] gap-2.5">
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-border p-3.5">
              <span className="text-[13px] font-semibold">{t('landing.mock.budgets')}</span>
              {BUDGETS.map((b, i) => {
                const fill = at(800 + i * 110, cn('block h-full origin-left rounded-[9px]', BAR[b.tone]), 'animate-ft-grow-x');
                return (
                  <div key={b.name} className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px]" style={{ background: b.tint }}>
                        {b.emoji}
                      </span>
                      <span className="flex-1 text-[12px] font-medium">{t(b.name)}</span>
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
              <span className="pb-1.5 text-[13px] font-semibold">{t('landing.mock.recent')}</span>
              {TX.map((tx, i) => {
                const row = at(850 + i * 90, 'flex h-[46px] items-center gap-2.5');
                return (
                  <div key={tx.name} className={row.className} style={row.style}>
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[14px]" style={{ background: tx.tint }}>
                      {tx.emoji}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[12.5px] font-medium">{t(tx.name)}</span>
                      <span className="text-[11px] leading-[14px] text-text-muted">{t(tx.meta)}</span>
                    </span>
                    <span className={cn('whitespace-nowrap text-[12.5px] font-semibold', tx.colour)}>{nb(`${tx.amount} ${currencyWord()}`)}</span>
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

/** Height the desktop scene is drawn at; the phone's bottom edge sits at 668. */
const SCENE_HEIGHT = 660;

/** Measures before paint in the browser; the build-time render (no layout there) skips it quietly. */
const useBrowserLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

/**
 * From 820px the scene shrinks to the height the hero leaves it (one screen minus header and
 * padding), so short laptop screens see it whole; it never grows past its drawn size.
 */
function useSceneScale(box: React.RefObject<HTMLDivElement | null>): number {
  const wide = useMediaQuery('(min-width: 820px)');
  const [scale, setScale] = React.useState(1);

  useBrowserLayoutEffect(() => {
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

/**
 * Browser bleeding off the right edge with the phone in front; scaled down below 820px.
 * Scaled with transform, not zoom: iOS Safari zooms the boxes but leaves the text at full size,
 * so labels wrapped and figures were cut. The entrance animates its own transform, hence the
 * extra wrapper around each mock.
 */
export function HeroVisual() {
  const at = useEntrance();
  const play = !useReducedMotion();
  const boxRef = React.useRef<HTMLDivElement>(null);
  const scale = useSceneScale(boxRef);
  const browser = at(150, undefined, 'animate-ft-slide-in');
  const phone = at(450);
  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={t('landing.hero.sceneLabel')}
      className="relative h-[480px] min-w-0 flex-[1_1_560px] min-[820px]:h-[clamp(400px,calc(100svh-65px-2*var(--hero-pad,0px)),660px)]"
    >
      <div
        className="absolute inset-0 origin-top-left min-[820px]:bottom-auto min-[820px]:h-[660px]"
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      >
        <div
          aria-hidden
          className="absolute left-0 top-0 origin-top-left scale-50 min-[820px]:left-[76px] min-[820px]:top-2.5 min-[820px]:scale-100"
        >
          <div className={browser.className} style={browser.style}>
            <BrowserMock at={at} />
          </div>
        </div>
        <div
          aria-hidden
          className="absolute right-1.5 top-11 origin-top-right scale-[0.76] min-[820px]:-left-7 min-[820px]:right-auto min-[820px]:top-24 min-[820px]:scale-100"
        >
          <div className={phone.className} style={phone.style && { ...phone.style, animationDuration: '900ms' }}>
            <PhoneMock at={at} play={play} />
          </div>
        </div>
      </div>
    </div>
  );
}
