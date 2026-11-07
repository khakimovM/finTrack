import { somToTiyin } from '@fintrack/shared';

/**
 * Reads the notification a card network's official Telegram bot sends for every card
 * operation, as forwarded to our bot. The bots write their labels in the language the person
 * chose (and the processing's own Latin-Russian words), so nothing here relies on words: every
 * field has its own emoji line, and the sign line says whether money left or came in.
 */

export type CardNetwork = 'UZCARD' | 'HUMO';

export interface CardOperation {
  network: CardNetwork;
  /** Last four digits of the card: the only part of the number the notification shows. */
  last4: string;
  direction: 'DEBIT' | 'CREDIT';
  /** Tiyin, always positive. */
  amount: bigint;
  /** The merchant or terminal name, without the address that may follow it. */
  merchant: string;
  /** The operation's own label, e.g. "Pokupka", "To'lov", "OTMENA E-Com oplata". */
  label: string;
  /** Tashkent time as the bank wrote it. */
  date: string;
  time: string;
  /** Card balance right after the operation, when the bank includes it. */
  balanceAfter: bigint | null;
  /** The bank cancelled an earlier operation ("OTMENA", "Bekor qilish"…): money came back. */
  reversal: boolean;
}

export type CardMessage =
  | { kind: 'operation'; operation: CardOperation }
  | { kind: 'ignored'; reason: 'declined' | 'foreign-currency' | 'not-an-operation' };

const SIGN_LINE = /^([➖➕])\s*([\d\s.,]+?)\s*([A-Z]{3})\s*$/u;
const BALANCE_PREFIXES = ['💵', '💰'];
const CLOCK = /^[🕐-🕧]/u;
const REVERSAL = /otmena|отмена|bekor|бекор|cancel|revers|qaytar|қайтар|возврат|refund/i;
// Uzcard writes a refused payment as one line with a zero amount: no money moved.
const DECLINED = /nedostatochno|недостаточно|yetarli emas|етарли эмас|insufficient|declined|rad etildi|рад этилди|отказ/i;

export function parseCardMessage(text: string, network: CardNetwork): CardMessage {
  const lines = text
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const signLine = lines.map((line) => SIGN_LINE.exec(line)).find((match) => match !== null);
  if (!signLine) {
    return { kind: 'ignored', reason: DECLINED.test(text) ? 'declined' : 'not-an-operation' };
  }
  const [, sign, amountText, currency] = signLine;
  if (currency !== 'UZS') return { kind: 'ignored', reason: 'foreign-currency' };

  const amount = parseBankAmount(amountText);
  const card = lineAfter(lines, '💳');
  const last4 = card ? /(\d{4})\s*$/.exec(card)?.[1] : undefined;
  const when = parseWhen(lines.find((line) => CLOCK.test(line)) ?? '');
  if (amount === null || amount === 0n || !last4 || !when) {
    return { kind: 'ignored', reason: amount === 0n ? 'declined' : 'not-an-operation' };
  }

  const label = stripEmoji(lines[0]);
  const balance = BALANCE_PREFIXES.map((prefix) => lineAfter(lines, prefix)).find((line) => line !== undefined);
  return {
    kind: 'operation',
    operation: {
      network,
      last4,
      direction: sign === '➖' ? 'DEBIT' : 'CREDIT',
      amount,
      merchant: merchantName(lineAfter(lines, '📍') ?? ''),
      label,
      date: when.date,
      time: when.time,
      balanceAfter: balance ? parseBankAmount(balance.replace(/[A-Za-z' ]+$/, '')) : null,
      reversal: REVERSAL.test(label),
    },
  };
}

/**
 * "30 330.00" (Uzcard), "1.700,00" (Humo), "1 969 180.70": the last separator before exactly
 * two digits is the decimal one, every other one groups thousands.
 */
export function parseBankAmount(text: string): bigint | null {
  const compact = text.replace(/\s/g, '');
  const match = /^(\d[\d.,]*?)(?:[.,](\d{2}))?$/.exec(compact);
  if (!match) return null;
  const whole = match[1].replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole)) return null;
  return somToTiyin(match[2] ? `${whole}.${match[2]}` : whole);
}

/** "31.10.26 23:07" (Uzcard) or "08:00 19.02.2026" (Humo). */
function parseWhen(line: string): { date: string; time: string } | null {
  const date = /(\d{2})\.(\d{2})\.(\d{4}|\d{2})(?!\d)/.exec(line);
  const time = /(?<!\d)(\d{1,2}):(\d{2})(?!\d)/.exec(line);
  if (!date || !time) return null;
  const [, day, month, year] = date;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const hours = Number(time[1]);
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31 || hours > 23) return null;
  return { date: `${fullYear}-${month}-${day}`, time: `${String(hours).padStart(2, '0')}:${time[2]}` };
}

/** Uzcard appends the terminal's address after a comma; the name before it is the merchant. */
function merchantName(line: string): string {
  return line.split(',')[0].replace(/\s+/g, ' ').trim();
}

function lineAfter(lines: string[], emoji: string): string | undefined {
  const line = lines.find((l) => l.startsWith(emoji));
  return line === undefined ? undefined : line.slice(emoji.length).trim();
}

function stripEmoji(line: string): string {
  return line.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}
