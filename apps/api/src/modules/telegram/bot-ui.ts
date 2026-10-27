import type { InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'grammy/types';
import { AppLocale, CURRENCY_WORD, MONTHS_IN_DATE, diffInDays, formatMoney } from '@fintrack/shared';
import { escapeHtml } from '../auth/telegram-login.messages';
import { TransactionDraft } from './drafts/draft.store';
import { BOT_TEXTS } from './i18n';

/**
 * Mini App entry point, or undefined when it cannot be opened: Telegram only opens HTTPS pages.
 * The app starts on /app; the web router takes care of the rest.
 */
export function miniAppUrl(webAppUrl?: string): string | undefined {
  if (!webAppUrl?.startsWith('https://')) return undefined;
  return `${webAppUrl.replace(/\/+$/, '')}/app`;
}

/**
 * A web_app button on this reply keyboard would open the Mini App without initData (Telegram
 * does not sign keyboard launches), so the app button is a plain one answered with an inline one.
 * Not persistent: a persistent menu takes half a phone screen and Telegram gives no way to put it
 * away; without the flag the chat's input field gets a button that hides and brings it back.
 */
export function mainMenu(locale: AppLocale, webAppUrl?: string): ReplyKeyboardMarkup {
  const menu = BOT_TEXTS[locale].menu;
  const rows: ReplyKeyboardMarkup['keyboard'] = [
    [{ text: menu.expense }, { text: menu.income }],
    [{ text: menu.balance }, { text: menu.recent }],
    [{ text: menu.report }, { text: menu.budgets }],
    [{ text: menu.debts }, { text: menu.settings }],
  ];
  if (miniAppUrl(webAppUrl)) rows.push([{ text: menu.app }]);
  return { keyboard: rows, resize_keyboard: true };
}

export function openAppKeyboard(locale: AppLocale, url: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: BOT_TEXTS[locale].common.openApp, web_app: { url } }]] };
}

/** The admin panel as a Mini App (HTTPS only, like the app); its page signs in with initData. */
export function adminPanelUrl(webAppUrl?: string): string | undefined {
  if (!webAppUrl?.startsWith('https://')) return undefined;
  return `${webAppUrl.replace(/\/+$/, '')}/admin`;
}

/** An inline web_app button: unlike a keyboard one, Telegram signs its launch data. */
export function openAdminKeyboard(url: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: '🛡 Admin panelni ochish', web_app: { url } }]] };
}

/** The admin panel is Uzbek only, and so is what the bot tells its admins about it. */
export const ADMIN_TEXT = {
  open: '🛡 <b>Admin panel</b>\n\nTugma faqat sizga ko‘rinadi. Har bir ochilish alohida kirish hisoblanadi va audit’ga yoziladi.',
  /** Local development: Telegram opens only HTTPS Mini Apps. */
  noHttps: (site: string) => `🛡 Admin panel Telegram ichida faqat HTTPS saytda ochiladi. Brauzerda: ${site}/admin/login`,
  monthlyPreparing: '⏳ Shu oyning hisoboti tayyorlanmoqda: avval matn, keyin ovoz…',
  monthlyNoVoice: '🔇 Ovoz yaratilmadi: TTS kaliti yo‘q yoki hamma provayder rad etdi. Tafsilot — admin paneldagi “Tizim” sahifasida.',
  monthlyFailed: 'Hisobotni yuborib bo‘lmadi.',
};

/** The admins' own command menu (scope chat): the panel, and the monthly report on demand. */
export const ADMIN_COMMANDS = [
  { command: 'admin', description: 'Admin panel' },
  { command: 'oylik', description: 'Oylik hisobot (sinov)' },
];

export function money(tiyin: bigint | string, locale: AppLocale): string {
  return formatMoney(tiyin, { currency: CURRENCY_WORD[locale] });
}

export function signedMoney(tiyin: bigint, locale: AppLocale): string {
  return tiyin < 0n ? `−${money(-tiyin, locale)}` : money(tiyin, locale);
}

/** 10-cell text progress bar for budgets and category shares. */
export function bar(percent: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

export function dayLabel(date: string, today: string, locale: AppLocale): string {
  const [y, m, d] = date.split('-');
  const human = `${d}.${m}.${y}`;
  const diff = diffInDays(date, today);
  const { today: todayWord, yesterday } = BOT_TEXTS[locale].common;
  if (diff === 0) return `${human} (${todayWord})`;
  if (diff === 1) return `${human} (${yesterday})`;
  return human;
}

/**
 * A report's dates as the app writes them: "1–22-oktabr", "28-sentabr – 4-oktabr"; in Russian
 * "1–22 октября", "28 сентября – 4 октября".
 */
export function periodLabel(from: string, to: string, locale: AppLocale): string {
  const months = MONTHS_IN_DATE[locale];
  const [a, b] = [from, to].map((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d, day: locale === 'ru' ? `${d} ${months[m - 1]}` : `${d}-${months[m - 1]}` };
  });
  const withYear = (p: { y: number; day: string }) => (locale === 'ru' ? `${p.day} ${p.y}` : `${p.day}, ${p.y}`);
  if (a.y !== b.y) return `${withYear(a)} – ${withYear(b)}`;
  if (a.m !== b.m) return `${a.day} – ${b.day}`;
  return a.d === b.d ? a.day : `${a.d}–${b.day}`;
}

export interface DraftView {
  locale: AppLocale;
  draft: TransactionDraft;
  categoryLabel: string | null;
  accountLabel: string;
  today: string;
}

export function draftCard({ locale, draft, categoryLabel, accountLabel, today }: DraftView): string {
  const t = BOT_TEXTS[locale].draft;
  return [
    `${draft.type === 'INCOME' ? t.income : t.expense} — <b>${money(draft.amount, locale)}</b>`,
    `📁 ${categoryLabel ? escapeHtml(categoryLabel) : t.noCategory}`,
    `💳 ${escapeHtml(accountLabel)}`,
    `📅 ${dayLabel(draft.date, today, locale)}`,
    draft.note ? `📝 ${escapeHtml(draft.note)}` : null,
    '',
    draft.source === 'voice' ? t.fromVoice : t.check,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function draftKeyboard(draft: TransactionDraft, locale: AppLocale): InlineKeyboardMarkup {
  const b = BOT_TEXTS[locale].buttons;
  return {
    inline_keyboard: [
      [{ text: b.save, callback_data: `d:${draft.id}:save` }],
      [
        { text: b.category, callback_data: `d:${draft.id}:cats` },
        { text: b.account, callback_data: `d:${draft.id}:accs` },
      ],
      [
        { text: draft.type === 'INCOME' ? b.toExpense : b.toIncome, callback_data: `d:${draft.id}:flip` },
        { text: b.cancel, callback_data: `d:${draft.id}:cancel` },
      ],
    ],
  };
}

/** Two buttons per row; `pick` builds the callback data for each option id. */
export function pickerKeyboard(
  options: Array<{ id: string; label: string }>,
  pick: (id: string) => string,
  back: string,
  locale: AppLocale,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < options.length; i += 2) {
    rows.push(options.slice(i, i + 2).map((o) => ({ text: o.label, callback_data: pick(o.id) })));
  }
  rows.push([{ text: BOT_TEXTS[locale].buttons.back, callback_data: back }]);
  return { inline_keyboard: rows };
}
