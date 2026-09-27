import type { InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'grammy/types';
import { diffInDays, formatMoney } from '@fintrack/shared';
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
} as const;

export function mainMenu(webAppUrl?: string): ReplyKeyboardMarkup {
  const rows: ReplyKeyboardMarkup['keyboard'] = [
    [{ text: MENU.expense }, { text: MENU.income }],
    [{ text: MENU.balance }, { text: MENU.recent }],
    [{ text: MENU.report }, { text: MENU.budgets }],
    [{ text: MENU.debts }, { text: MENU.settings }],
  ];
  // Telegram only opens Mini Apps over HTTPS.
  if (webAppUrl?.startsWith('https://')) {
    rows.push([{ text: '🌐 Ilovani ochish', web_app: { url: webAppUrl } }]);
  }
  return { keyboard: rows, resize_keyboard: true, is_persistent: true };
}

export const TEXT = {
  menuIntro:
    'Xarajat yoki kirimni shunchaki yozing, masalan:\n' +
    '• <code>50000 taksi</code>\n• <code>45k tushlik</code>\n• <code>+8 500 000 oylik</code>\n• <code>kecha 1,2 mln ijara</code>\n\n' +
    'Yoki pastdagi menyudan foydalaning 👇',
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
