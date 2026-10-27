import { plural, PluralForms } from './i18n/plural';

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

const RU_UNITS = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const RU_UNITS_FEMININE = ['', 'одна', 'две', ...RU_UNITS.slice(3)];
const RU_TEENS = [
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
  'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
];
const RU_TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const RU_HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
// "тысяча" is feminine, so its group says "одна"/"две" ("две тысячи", not "два тысячи").
const RU_SCALES: { forms: PluralForms; feminine: boolean }[] = [
  { forms: { one: '', other: '' }, feminine: false },
  { forms: { one: 'тысяча', few: 'тысячи', many: 'тысяч', other: 'тысячи' }, feminine: true },
  { forms: { one: 'миллион', few: 'миллиона', many: 'миллионов', other: 'миллиона' }, feminine: false },
  { forms: { one: 'миллиард', few: 'миллиарда', many: 'миллиардов', other: 'миллиарда' }, feminine: false },
  { forms: { one: 'триллион', few: 'триллиона', many: 'триллионов', other: 'триллиона' }, feminine: false },
];

function belowThousandRu(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  if (n >= 100) words.push(RU_HUNDREDS[Math.floor(n / 100)]);
  const rest = n % 100;
  if (rest >= 10 && rest < 20) return [...words, RU_TEENS[rest - 10]];
  if (rest >= 20) words.push(RU_TENS[Math.floor(rest / 10)]);
  if (rest % 10 > 0) words.push((feminine ? RU_UNITS_FEMININE : RU_UNITS)[rest % 10]);
  return words;
}

/**
 * A whole number in Russian words, for the same reason as numberToWordsUz: "один миллион двести
 * пятьдесят тысяч". `feminine` agrees the last word with a feminine noun: "одна запись", "две записи".
 */
export function numberToWordsRu(value: number, gender: 'masculine' | 'feminine' = 'masculine'): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Not a whole number ≥ 0: ${value}`);
  if (value === 0) return 'ноль';

  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  if (groups.length > RU_SCALES.length) throw new RangeError(`Too large to spell: ${value}`);

  const words: string[] = [];
  for (let scale = groups.length - 1; scale >= 0; scale--) {
    if (groups[scale] === 0) continue;
    const { forms, feminine } = RU_SCALES[scale];
    words.push(...belowThousandRu(groups[scale], scale === 0 ? gender === 'feminine' : feminine));
    if (scale > 0) words.push(plural('ru', groups[scale], forms));
  }
  return words.join(' ');
}
