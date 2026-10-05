import { TIYIN_PER_SOM } from '@fintrack/shared';

/** No-break space: an amount never wraps between its digits and "so‘m". */
export const NBSP = String.fromCharCode(0x00a0);
/** Typographic minus (U+2212), the same width as "+". */
export const MINUS = String.fromCharCode(0x2212);
export const CURRENCY = 'so‘m';

export type AmountTone = 'income' | 'expense' | 'transfer' | 'debt' | 'adjustment' | 'neutral';

function toBigInt(value: string | bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/** Absolute value grouped with NBSP: 4305000000 tiyin → "43 050 000", 150050 → "1 500,50". */
export function formatAmountNumber(tiyin: string | bigint | number): string {
  const value = toBigInt(tiyin);
  const abs = value < 0n ? -value : value;
  const whole = (abs / TIYIN_PER_SOM).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const frac = (abs % TIYIN_PER_SOM).toString().padStart(2, '0');
  return frac === '00' ? whole : `${whole},${frac}`;
}

/** "43 050 000 so‘m" with the sign the caller asks for (none by default). */
export function formatAmount(
  tiyin: string | bigint | number,
  options: { sign?: '+' | '-' | 'auto' | 'negative' | 'none'; currency?: boolean } = {},
): string {
  const value = toBigInt(tiyin);
  const { sign = 'none', currency = true } = options;
  let prefix = '';
  if (sign === '+') prefix = '+';
  else if (sign === '-') prefix = MINUS;
  else if (sign === 'auto') prefix = value < 0n ? MINUS : value > 0n ? '+' : '';
  // Balances: a minus when below zero, nothing otherwise.
  else if (sign === 'negative') prefix = value < 0n ? MINUS : '';
  return `${prefix}${formatAmountNumber(value)}${currency ? `${NBSP}${CURRENCY}` : ''}`;
}

/** How a ledger entry is shown: sign plus colour. Debt and transfer amounts carry no sign. */
export function toneOf(type: string): AmountTone {
  switch (type) {
    case 'INCOME':
      return 'income';
    case 'EXPENSE':
      return 'expense';
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT':
      return 'transfer';
    case 'LOAN_GIVEN':
    case 'LOAN_TAKEN':
    case 'LOAN_REPAY_IN':
    case 'LOAN_REPAY_OUT':
      return 'debt';
    case 'ADJUSTMENT':
      return 'adjustment';
    default:
      return 'neutral';
  }
}

export function signOf(tone: AmountTone): '+' | '-' | 'none' {
  if (tone === 'income' || tone === 'adjustment') return '+';
  if (tone === 'expense') return '-';
  return 'none';
}

/** Tailwind text colour for a tone. */
export const TONE_CLASS: Record<AmountTone, string> = {
  income: 'text-income',
  expense: 'text-expense',
  transfer: 'text-transfer',
  debt: 'text-debt',
  adjustment: 'text-text-secondary',
  neutral: 'text-text',
};

function oneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}

/** Chart axis / donut centre form, from so‘m: "1,5 mln", "250 ming", "2 mlrd", "800". */
export function shortSom(som: number): string {
  const abs = Math.abs(som);
  const sign = som < 0 ? MINUS : '';
  if (abs >= 1_000_000_000) return `${sign}${oneDecimal(abs / 1_000_000_000)} mlrd`;
  if (abs >= 1_000_000) return `${sign}${oneDecimal(abs / 1_000_000)} mln`;
  if (abs >= 1_000) return `${sign}${oneDecimal(abs / 1_000)} ming`;
  return `${sign}${Math.round(abs)}`;
}

/** Same as shortSom for a tiyin string, which is what the API returns. */
export function shortMoney(tiyin: string | bigint | number): string {
  const value = toBigInt(tiyin);
  return shortSom(Number(value / TIYIN_PER_SOM));
}

/** Tiyin → so‘m as a JS number, for charts only (never for arithmetic on money). */
export function tiyinToChartNumber(tiyin: string | bigint | number): number {
  return Number(toBigInt(tiyin) / TIYIN_PER_SOM);
}
