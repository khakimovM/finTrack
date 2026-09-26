export const TIYIN_PER_SOM = 100n;

export class InvalidAmountError extends Error {
  constructor(value: unknown) {
    super(`Noto‘g‘ri summa formati: ${String(value)}`);
    this.name = 'InvalidAmountError';
  }
}

/**
 * Converts som string or number into BigInt tiyin.
 * Examples: "1500" -> 150000n, "1500.50" -> 150050n, "1 500,50" -> 150050n, "-50.25" -> -5025n
 */
export function somToTiyin(som: string | number): bigint {
  const normalized = String(som).replace(/\s+/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new InvalidAmountError(som);
  }

  const isNegative = normalized.startsWith('-');
  const clean = isNegative ? normalized.slice(1) : normalized;
  const [whole, frac = ''] = clean.split('.');
  const wholePart = BigInt(whole) * TIYIN_PER_SOM;
  const fracPart = BigInt(frac.padEnd(2, '0'));
  const total = wholePart + fracPart;

  return isNegative ? -total : total;
}

/**
 * Converts BigInt tiyin into decimal som string.
 * Examples: 150050n -> "1500.50", 150000n -> "1500.00", -5025n -> "-50.25"
 */
export function tiyinToSom(tiyin: bigint | string): string {
  const value = BigInt(tiyin);
  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;
  const whole = abs / TIYIN_PER_SOM;
  const frac = (abs % TIYIN_PER_SOM).toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}${whole}.${frac}`;
}

/**
 * Formats tiyin into human-readable string with Uzbek som style.
 * Example: 150050n -> "1 500,50 so‘m"
 */
export function formatMoney(
  tiyin: bigint | string,
  opts?: { currency?: string; showFraction?: boolean },
): string {
  const currency = opts?.currency ?? 'so‘m';
  const value = BigInt(tiyin);
  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;
  const whole = abs / TIYIN_PER_SOM;
  const frac = (abs % TIYIN_PER_SOM).toString().padStart(2, '0');

  // Format thousands with space
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const showFraction = opts?.showFraction ?? frac !== '00';
  const fractionStr = showFraction ? `,${frac}` : '';

  return `${isNegative ? '-' : ''}${wholeStr}${fractionStr} ${currency}`.trim();
}

/**
 * Adds multiple money amounts together in tiyin.
 */
export function addMoney(...amounts: (bigint | string)[]): bigint {
  return amounts.reduce<bigint>((acc, val) => acc + BigInt(val), 0n);
}

/**
 * Subtracts b from a in tiyin.
 */
export function subMoney(a: bigint | string, b: bigint | string): bigint {
  return BigInt(a) - BigInt(b);
}
