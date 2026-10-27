import { ChevronLeft, Mic } from 'lucide-react';
import { LogoBars } from '../../components/brand/Logo';
import { NBSP } from '../../lib/money';
import { t } from '../../lib/i18n';
import type { Entrance } from './reveal';

const nb = (text: string) => text.replace(/ /g, NBSP);

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
export function PhoneMock({ at, play }: { at: Entrance; play: boolean }) {
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
            <span className="text-[11px] leading-[14px] text-text-muted">{t('landing.mock.bot')}</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-2 px-2.5 py-3">
          <span className={day.className} style={day.style}>
            {t('landing.mock.today')}
          </span>
          <div className={message.className} style={message.style}>
            {t('landing.mock.message')} <span className="ml-1 text-[10px] leading-3 text-text-secondary">12:04 ✓✓</span>
          </div>
          {/* The draft keeps its place from the start, so nothing above it moves when it arrives. */}
          <div className="relative mr-6">
            {play && <Typing />}
            <div className={draft.className} style={draft.style}>
              <span className="text-[11px] font-semibold text-text-muted">{t('landing.mock.draft')}</span>
              <span className="text-[14.5px] font-semibold leading-5">{nb(t('landing.mock.draftAmount'))}</span>
              <span className="text-[12.5px] text-text-secondary">{t('landing.mock.draftCategory')}</span>
              <span className="text-[12.5px] text-text-secondary">{t('landing.mock.draftAccount')}</span>
              <span className="self-end text-[10px] text-text-muted">12:04</span>
            </div>
          </div>
          <div className={buttons.className} style={buttons.style}>
            <span className="col-span-2 flex h-[34px] items-center justify-center rounded-[10px] border border-border bg-card text-[12.5px] font-semibold">
              {t('landing.mock.save')}
            </span>
            <span className="flex h-[34px] items-center justify-center rounded-[10px] border border-border bg-card text-[12px] font-medium">
              {t('landing.mock.category')}
            </span>
            <span className="flex h-[34px] items-center justify-center rounded-[10px] border border-border bg-card text-[12px] font-medium">
              {t('landing.mock.cancel')}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-card px-2 pb-5 pt-2">
          <span className="flex h-8 items-center rounded-full bg-brand px-3 text-[12px] font-semibold text-brand-foreground">{t('landing.mock.miniApp')}</span>
          <span className="flex h-8 flex-1 items-center rounded-full bg-surface px-3 text-[12.5px] text-text-muted">{t('landing.mock.composer')}</span>
          <span className="flex h-8 w-8 items-center justify-center text-text-secondary">
            <Mic className="h-[17px] w-[17px]" />
          </span>
        </div>
      </div>
    </div>
  );
}
