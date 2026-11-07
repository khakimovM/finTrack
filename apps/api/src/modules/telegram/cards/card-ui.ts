import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'grammy/types';
import { CardNetwork, CardOperationStatus, CardResolution } from '@prisma/client';
import { AppLocale, formatMoney } from '@fintrack/shared';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { money } from '../bot-ui';
import { MerchantKind } from './merchant';
import { CARD_TEXTS, CardTexts } from './card-texts';

/** Telegram's limit is 4096; the rest is room for the lines that are always there. */
const SUMMARY_BUDGET = 3900;
const LINE_LIMITS = [12, 8, 5, 3, 0];
export const LIST_PAGE_SIZE = 8;

export interface OperationView {
  seq: number;
  direction: 'DEBIT' | 'CREDIT';
  amount: bigint;
  merchant: string;
  card: string;
  /** "31.10 23:07" */
  when: string;
  kind: MerchantKind;
  reversal: boolean;
  status: CardOperationStatus;
  resolution: CardResolution | null;
  category: string | null;
  counterAccount: string | null;
  partner: { seq: number; card: string; amount: bigint } | null;
  debtPerson: string | null;
}

export interface ImportView {
  id: string;
  locale: AppLocale;
  period: string;
  cards: Array<{ label: string; account: string | null }>;
  operations: OperationView[];
  ignored: number;
  repeated: number;
  /** After something was saved: each card's bank balance next to its account's. */
  balances: Array<{ card: string; bank: bigint; ledger: bigint }> | null;
}

export interface Screen {
  text: string;
  keyboard: InlineKeyboardMarkup;
}

export type Mode = 'r' | 'e';

export function cardLabel(network: CardNetwork, last4: string): string {
  return `${network === 'HUMO' ? 'Humo' : 'Uzcard'} •${last4}`;
}

const bare = (tiyin: bigint) => formatMoney(tiyin, { currency: '' });
const sign = (op: Pick<OperationView, 'direction'>) => (op.direction === 'DEBIT' ? '➖' : '➕');
export const pending = (ops: OperationView[]) => ops.filter((op) => op.status === 'PENDING');
export const undecided = (ops: OperationView[]) => pending(ops).filter((op) => op.resolution === null);
export const decided = (ops: OperationView[]) => pending(ops).filter((op) => op.resolution !== null);

/** What an operation will become, in a few words; null while undecided. */
export function outcome(op: OperationView, t: CardTexts, locale: AppLocale): string | null {
  const it = t.item;
  switch (op.resolution) {
    case 'EXPENSE':
      return it.expense(escapeHtml(op.category ?? '—'));
    case 'INCOME':
      return it.income(escapeHtml(op.category ?? '—'));
    case 'TRANSFER':
      if (op.partner) {
        const fee = op.amount - op.partner.amount;
        return op.direction === 'DEBIT'
          ? it.pairOut(op.partner.card, fee > 0n ? t.fee(money(fee, locale)) : money(op.partner.amount, locale))
          : it.pairIn(op.partner.card);
      }
      return (op.direction === 'DEBIT' ? it.transferTo : it.transferFrom)(escapeHtml(op.counterAccount ?? '—'));
    case 'DEBT':
      return (op.direction === 'DEBIT' ? it.lent : it.borrowed)(escapeHtml(op.debtPerson ?? '—'));
    case 'DUPLICATE':
      return it.duplicate;
    case 'CANCELLED':
      return it.cancelled;
    case 'SKIP':
      return it.skip;
    default:
      return null;
  }
}

function line(op: OperationView, t: CardTexts, locale: AppLocale): string {
  const what = op.resolution === 'EXPENSE' || op.resolution === 'INCOME' ? escapeHtml(op.category ?? '—') : outcome(op, t, locale);
  const parts = [`#${op.seq} ${sign(op)}${bare(op.amount)}`, what, escapeHtml(op.merchant), op.when.slice(0, 5)];
  return parts.filter(Boolean).join(' · ');
}

export function summaryScreen(view: ImportView): Screen {
  const t = CARD_TEXTS[view.locale];
  const open = pending(view.operations);
  const saved = view.operations.filter((op) => op.status !== 'PENDING');
  const groups: Array<[string, OperationView[]]> = [
    [`✅ ${t.groups.ready}`, open.filter((op) => op.resolution === 'EXPENSE' || op.resolution === 'INCOME')],
    [`🔁 ${t.groups.transfers}`, open.filter((op) => op.resolution === 'TRANSFER')],
    [`🤝 ${t.groups.debts}`, open.filter((op) => op.resolution === 'DEBT')],
    [`♻️ ${t.groups.duplicates}`, open.filter((op) => op.resolution === 'DUPLICATE')],
    [`↩️ ${t.groups.cancelled}`, open.filter((op) => op.resolution === 'CANCELLED')],
    [`⏭ ${t.groups.skipped}`, open.filter((op) => op.resolution === 'SKIP')],
    [`❓ ${t.groups.review}`, open.filter((op) => op.resolution === null)],
  ];

  // A burst of only repeats and non-operations has no period or cards to speak of.
  const head =
    view.operations.length === 0
      ? [t.nothingNew]
      : [t.title(view.operations.length, view.period), ...view.cards.map((c) => t.cardLine(c.label, escapeHtml(c.account ?? '❓')))];
  if (saved.length > 0) head.push('', t.saved(saved.length));
  if (view.balances && view.balances.length > 0) {
    head.push(t.balanceTitle);
    for (const b of view.balances) {
      head.push(b.bank === b.ledger ? t.balanceOk(b.card, money(b.bank, view.locale)) : t.balanceDiff(b.card, money(b.bank, view.locale), money(b.ledger, view.locale)));
    }
  }
  const tail: string[] = [];
  if (undecided(view.operations).length > 0) tail.push(t.reviewHint);
  if (view.repeated > 0) tail.push(t.repeated(view.repeated));
  if (view.ignored > 0) tail.push(t.ignored(view.ignored));

  let text = '';
  for (const limit of LINE_LIMITS) {
    const body: string[] = [];
    for (const [title, ops] of groups) {
      if (ops.length === 0) continue;
      body.push('', `<b>${title}: ${ops.length}</b>`, ...ops.slice(0, limit).map((op) => line(op, t, view.locale)));
      if (ops.length > limit && limit > 0) body.push(t.more(ops.length - limit));
    }
    text = [...head, ...body, ...(tail.length ? ['', ...tail] : [])].join('\n');
    if (text.length <= SUMMARY_BUDGET) break;
  }
  return { text, keyboard: summaryKeyboard(view, t) };
}

function summaryKeyboard(view: ImportView, t: CardTexts): InlineKeyboardMarkup {
  const b = t.buttons;
  const cb = (action: string) => `ci:${view.id}:${action}`;
  const rows: InlineKeyboardButton[][] = [];
  const ready = decided(view.operations).length;
  const open = undecided(view.operations).length;
  const anySaved = view.operations.some((op) => op.status !== 'PENDING');
  if (ready > 0) rows.push([{ text: b.save(ready), callback_data: cb('save') }]);
  const middle: InlineKeyboardButton[] = [];
  if (open > 0) middle.push({ text: b.review(open), callback_data: cb('rev') });
  if (pending(view.operations).length > 0) middle.push({ text: b.edit, callback_data: cb('list:1') });
  if (middle.length > 0) rows.push(middle);
  if (view.balances?.some((x) => x.bank !== x.ledger)) rows.push([{ text: b.reconcile, callback_data: cb('bal') }]);
  if (anySaved) rows.push([{ text: b.undo, callback_data: cb('undo') }]);
  else if (view.operations.length > 0) rows.push([{ text: b.cancel, callback_data: cb('cancel') }]);
  return { inline_keyboard: rows };
}

function hint(op: OperationView, t: CardTexts, locale: AppLocale): string | null {
  const h = t.item.hints;
  if (op.partner && (op.resolution === null || op.resolution === 'TRANSFER') && !op.reversal) {
    const [from, to] = op.direction === 'DEBIT' ? [op.card, op.partner.card] : [op.partner.card, op.card];
    const fee = op.direction === 'DEBIT' ? op.amount - op.partner.amount : op.partner.amount - op.amount;
    return h.pair(from, to, fee > 0n ? t.fee(money(fee, locale)) : null);
  }
  if (op.resolution !== null) return null;
  if (op.reversal) return h.refund;
  if (op.kind === 'P2P') return h.p2p;
  if (op.kind === 'OWN_TRANSFER') return h.own;
  if (op.kind === 'PAYMENT_SERVICE') return h.service;
  return op.direction === 'DEBIT' ? h.shop : h.credit;
}

export function itemScreen(view: ImportView, op: OperationView, mode: Mode, page: number): Screen {
  const t = CARD_TEXTS[view.locale];
  const queue = undecided(view.operations);
  const position = queue.findIndex((o) => o.seq === op.seq);
  const header = mode === 'r' && position >= 0 ? t.item.position(position + 1, queue.length) : t.item.edit(op.seq);
  const note = hint(op, t, view.locale);
  const text = [
    header,
    `${sign(op)} <b>${money(op.amount, view.locale)}</b> · 💳 ${op.card}`,
    `📍 ${escapeHtml(op.merchant || '—')}`,
    `🕓 ${op.when}`,
    t.item.now(outcome(op, t, view.locale) ?? t.item.undecided),
    note ? `<i>${note}</i>` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
  return { text, keyboard: itemKeyboard(view.id, op, mode, page, t) };
}

function itemKeyboard(id: string, op: OperationView, mode: Mode, page: number, t: CardTexts): InlineKeyboardMarkup {
  const b = t.buttons;
  const cb = (action: string) => `ci:${id}:${mode}${op.seq}:${action}`;
  const rows: InlineKeyboardButton[][] = [];
  if (op.partner && (op.resolution === null || op.resolution === 'TRANSFER') && !op.reversal) {
    if (op.resolution === null) rows.push([{ text: b.transfer, callback_data: cb('ok') }]);
    rows.push([{ text: b.split, callback_data: cb('u') }]);
  } else if (op.resolution === 'CANCELLED') {
    rows.push([{ text: b.split, callback_data: cb('u') }]);
  } else {
    if (op.resolution === 'DUPLICATE') rows.push([{ text: b.notDuplicate, callback_data: cb('u') }]);
    const debit = op.direction === 'DEBIT';
    rows.push(
      [
        { text: debit ? b.expense : b.income, callback_data: cb(debit ? 'x' : 'i') },
        { text: debit ? b.lent : b.borrowed, callback_data: cb('d') },
      ],
      [
        { text: debit ? b.toOwn : b.fromOwn, callback_data: cb('t') },
        { text: b.skip, callback_data: cb('s') },
      ],
    );
  }
  const nav: InlineKeyboardButton[] =
    mode === 'r'
      ? [{ text: b.toList, callback_data: `ci:${id}:sum` }, { text: b.next, callback_data: cb('n') }]
      : [{ text: b.back, callback_data: `ci:${id}:list:${page}` }];
  rows.push(nav);
  return { inline_keyboard: rows };
}

/** Pending operations as buttons, a page at a time, to pick one and change it. */
export function listScreen(view: ImportView, page: number): Screen {
  const t = CARD_TEXTS[view.locale];
  const ops = pending(view.operations);
  const pages = Math.max(1, Math.ceil(ops.length / LIST_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const slice = ops.slice((current - 1) * LIST_PAGE_SIZE, current * LIST_PAGE_SIZE);
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < slice.length; i += 2) {
    rows.push(
      slice.slice(i, i + 2).map((op) => ({
        text: `${op.resolution === null ? '❓' : ''}#${op.seq} ${sign(op)}${bare(op.amount)} ${op.merchant}`.slice(0, 32),
        callback_data: `ci:${view.id}:e${op.seq}:v`,
      })),
    );
  }
  const nav: InlineKeyboardButton[] = [];
  if (current > 1) nav.push({ text: t.buttons.prev, callback_data: `ci:${view.id}:list:${current - 1}` });
  nav.push({ text: t.buttons.toList, callback_data: `ci:${view.id}:sum` });
  if (current < pages) nav.push({ text: t.buttons.next, callback_data: `ci:${view.id}:list:${current + 1}` });
  rows.push(nav);
  return { text: t.listTitle(current, pages), keyboard: { inline_keyboard: rows } };
}

/** Asks which account a card books to: one of the person's, or a new one named after the card. */
export function mappingScreen(
  importId: string,
  locale: AppLocale,
  card: { network: CardNetwork; last4: string },
  accounts: Array<{ id: string; label: string }>,
): Screen {
  const t = CARD_TEXTS[locale];
  const label = cardLabel(card.network, card.last4);
  const key = `${card.network === 'HUMO' ? 'H' : 'U'}${card.last4}`;
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < accounts.length; i += 2) {
    rows.push(accounts.slice(i, i + 2).map((a) => ({ text: a.label, callback_data: `cm:${importId}:${key}:${a.id}` })));
  }
  rows.push([{ text: t.mapping.newAccount(label), callback_data: `cm:${importId}:${key}:new` }]);
  rows.push([{ text: t.buttons.cancel, callback_data: `ci:${importId}:cancel` }]);
  return { text: t.mapping.question(label), keyboard: { inline_keyboard: rows } };
}
