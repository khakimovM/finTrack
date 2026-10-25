const UNITS = ['', 'bir', 'ikki', 'uch', 'to‘rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to‘qqiz'];
const TENS = ['', 'o‘n', 'yigirma', 'o‘ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', 'to‘qson'];
const SCALES = ['', 'ming', 'million', 'milliard', 'trillion'];

function belowThousand(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  // "yuz", not "bir yuz": that is how a hundred is said; two hundred is "ikki yuz".
  if (hundreds > 0) words.push(...(hundreds > 1 ? [UNITS[hundreds]] : []), 'yuz');
  const rest = n % 100;
  if (rest >= 10) words.push(TENS[Math.floor(rest / 10)]);
  if (rest % 10 > 0) words.push(UNITS[rest % 10]);
  return words;
}

/**
 * A whole number in Uzbek words, for text that is read aloud: speech engines say "1 250 000" in
 * unpredictable ways, "bir million ikki yuz ellik ming" they read as written.
 */
export function numberToWordsUz(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Not a whole number ≥ 0: ${value}`);
  if (value === 0) return 'nol';

  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  if (groups.length > SCALES.length) throw new RangeError(`Too large to spell: ${value}`);

  const words: string[] = [];
  for (let scale = groups.length - 1; scale >= 0; scale--) {
    if (groups[scale] === 0) continue;
    words.push(...belowThousand(groups[scale]));
    if (SCALES[scale]) words.push(SCALES[scale]);
  }
  return words.join(' ');
}
