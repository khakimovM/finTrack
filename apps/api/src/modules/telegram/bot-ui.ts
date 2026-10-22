import type { InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'grammy/types';
import { UZ_MONTHS, diffInDays, formatMoney } from '@fintrack/shared';
import { escapeHtml } from '../auth/telegram-login.messages';
import { TransactionDraft } from './drafts/draft.store';

export const MENU = {
  expense: '➖ Chiqim',
  income: '➕ Kirim',
  balance: '💰 Balans',
  recent: '📋 Oxirgi amallar',
  report: '📊 Hisobot',
  budgets: '🎯 Byudjet',
  debts: '🤝 Qarzlar',
  settings: '⚙️ Sozlamalar',
  app: '🌐 Ilova',
} as const;

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
 * does not sign keyboard launches), so "Ilova" is a plain button answered with an inline one.
 * Not persistent: a persistent menu takes half a phone screen and Telegram gives no way to put it
 * away; without the flag the chat's input field gets a button that hides and brings it back.
 */
export function mainMenu(webAppUrl?: string): ReplyKeyboardMarkup {
  const rows: ReplyKeyboardMarkup['keyboard'] = [
    [{ text: MENU.expense }, { text: MENU.income }],
    [{ text: MENU.balance }, { text: MENU.recent }],
    [{ text: MENU.report }, { text: MENU.budgets }],
    [{ text: MENU.debts }, { text: MENU.settings }],
  ];
  if (miniAppUrl(webAppUrl)) rows.push([{ text: MENU.app }]);
  return { keyboard: rows, resize_keyboard: true };
}

export function openAppKeyboard(url: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: '🌐 FinTrack ilovasini ochish', web_app: { url } }]] };
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

export const ADMIN_TEXT = {
  open: '🛡 <b>Admin panel</b>\n\nTugma faqat sizga ko‘rinadi. Har bir ochilish alohida kirish hisoblanadi va audit’ga yoziladi.',
  /** Local development: Telegram opens only HTTPS Mini Apps. */
  noHttps: (site: string) => `🛡 Admin panel Telegram ichida faqat HTTPS saytda ochiladi. Brauzerda: ${site}/admin/login`,
};

/** /admin in the command menu: shown only in the admins' own chats (scope chat). */
export const ADMIN_COMMAND = { command: 'admin', description: 'Admin panel' };

/** The bot's profile: under its name (≤120) and on the empty chat and t.me page (≤512). */
export const BOT_PROFILE = {
  short: (host: string) => `FinTrack — xarajat, daromad va qarzlar hisobi. Sayt va ilova: ${host}`,
  long: (site: string) =>
    'Xarajat va daromadni shu yerga bir jumla bilan yozing: «50000 taksi», «+8 500 000 oylik». ' +
    'FinTrack ularni kategoriyalarga ajratadi, byudjet va qarzlarni kuzatib boradi.\n\n' +
    `Sayt va ilova: ${site}`,
};

export const TEXT = {
  menuIntro:
    'Xarajat yoki kirimni shunchaki yozing, masalan:\n' +
    '• <code>50000 taksi</code>\n• <code>45k tushlik</code>\n• <code>+8 500 000 oylik</code>\n• <code>kecha 1,2 mln ijara</code>\n\n' +
    'Yoki pastdagi menyudan foydalaning 👇\n' +
    '<i>Menyuni yashirish yoki qayta ochish uchun yozish maydoni yonidagi tugmalar belgisini bosing.</i>',
  notRegistered: 'Avval ro‘yxatdan o‘ting: /start bosing va raqamingizni ulashing.',
  askEntry: (type: 'INCOME' | 'EXPENSE') =>
    type === 'INCOME'
      ? 'Kirim summasi va izohini yozing, masalan: <code>8 500 000 oylik</code>'
      : 'Chiqim summasi va izohini yozing, masalan: <code>50000 taksi</code>',
  notUnderstood:
    'Tushunmadim 🤔 Summani raqam bilan yozing, masalan: <code>50000 taksi</code> yoki <code>+2 mln oylik</code>.',
  draftExpired: 'Bu qoralama eskirgan. Qaytadan yozing.',
  genericError: 'Xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.',
};

export function money(tiyin: bigint | string): string {
  return formatMoney(tiyin);
}

export function signedMoney(tiyin: bigint): string {
  return tiyin < 0n ? `−${money(-tiyin)}` : money(tiyin);
}

/** 10-cell text progress bar for budgets and category shares. */
export function bar(percent: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

export function dayLabel(date: string, today: string): string {
  const [y, m, d] = date.split('-');
  const human = `${d}.${m}.${y}`;
  const diff = diffInDays(date, today);
  if (diff === 0) return `${human} (bugun)`;
  if (diff === 1) return `${human} (kecha)`;
  return human;
}

/** A report's dates as the app writes them: "1–22-oktabr", "28-sentabr – 4-oktabr". */
export function periodLabel(from: string, to: string): string {
  const [a, b] = [from, to].map((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d, day: `${d}-${UZ_MONTHS[m - 1]}` };
  });
  if (a.y !== b.y) return `${a.day}, ${a.y} – ${b.day}, ${b.y}`;
  if (a.m !== b.m) return `${a.day} – ${b.day}`;
  return a.d === b.d ? a.day : `${a.d}–${b.day}`;
}

export interface DraftView {
  draft: TransactionDraft;
  categoryLabel: string | null;
  accountLabel: string;
  today: string;
}

export function draftCard({ draft, categoryLabel, accountLabel, today }: DraftView): string {
  const title = draft.type === 'INCOME' ? '➕ <b>Kirim</b>' : '➖ <b>Chiqim</b>';
  return [
    `${title} — <b>${money(draft.amount)}</b>`,
    `📁 ${categoryLabel ? escapeHtml(categoryLabel) : '<i>kategoriya tanlanmagan</i>'}`,
    `💳 ${escapeHtml(accountLabel)}`,
    `📅 ${dayLabel(draft.date, today)}`,
    draft.note ? `📝 ${escapeHtml(draft.note)}` : null,
    '',
    draft.source === 'voice' ? '🎙 Ovozdan tanildi — tekshirib, saqlang.' : 'To‘g‘rimi? Saqlash uchun tugmani bosing.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function draftKeyboard(draft: TransactionDraft): InlineKeyboardMarkup {
  const flipLabel = draft.type === 'INCOME' ? '🔁 Chiqimga' : '🔁 Kirimga';
  return {
    inline_keyboard: [
      [{ text: '✅ Saqlash', callback_data: `d:${draft.id}:save` }],
      [
        { text: '📁 Kategoriya', callback_data: `d:${draft.id}:cats` },
        { text: '💳 Hisob', callback_data: `d:${draft.id}:accs` },
      ],
      [
        { text: flipLabel, callback_data: `d:${draft.id}:flip` },
        { text: '❌ Bekor', callback_data: `d:${draft.id}:cancel` },
      ],
    ],
  };
}

/** Two buttons per row; `pick` builds the callback data for each option id. */
export function pickerKeyboard(
  options: Array<{ id: string; label: string }>,
  pick: (id: string) => string,
  back: string,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < options.length; i += 2) {
    rows.push(options.slice(i, i + 2).map((o) => ({ text: o.label, callback_data: pick(o.id) })));
  }
  rows.push([{ text: '⬅️ Orqaga', callback_data: back }]);
  return { inline_keyboard: rows };
}
