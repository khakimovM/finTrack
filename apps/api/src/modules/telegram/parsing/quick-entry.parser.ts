/**
 * Deterministic parser for chat-style entries: "50000 taksi", "taksiga 20 ming", "1,5 mln ijara",
 * "+8 500 000 oylik", "kecha 45k tushlik", and the same in Russian: "45к обед", "вчера 1,2 млн
 * аренда", "+2 млн зарплата". Anything it cannot read confidently returns null and is handed to
 * the AI extractor instead — a wrong amount is worse than asking again.
 */

export interface QuickEntry {
  type: 'INCOME' | 'EXPENSE';
  /** Amount in tiyin. */
  amount: bigint;
  note: string;
  /** Days before today (0 = today, 1 = "kecha" / "вчера"). */
  daysAgo: number;
  /** True when the type came from an explicit sign or keyword rather than the default. */
  typeExplicit: boolean;
}

const MAX_TIYIN = 10n ** 18n;

const THOUSAND = 1_000n;
const MILLION = 1_000_000n;
const BILLION = 1_000_000_000n;

/** Every spelling of a unit after the number, Latin "k"/"m" and Cyrillic "к" included. */
const UNITS: Record<string, bigint> = {
  k: THOUSAND,
  ming: THOUSAND,
  m: MILLION,
  mln: MILLION,
  million: MILLION,
  mlrd: BILLION,
  к: THOUSAND,
  тыс: THOUSAND,
  тысяча: THOUSAND,
  тысячи: THOUSAND,
  тысяч: THOUSAND,
  тыща: THOUSAND,
  тыщи: THOUSAND,
  тыщ: THOUSAND,
  млн: MILLION,
  миллион: MILLION,
  миллиона: MILLION,
  миллионов: MILLION,
  млрд: BILLION,
  миллиард: BILLION,
  миллиарда: BILLION,
  миллиардов: BILLION,
};

/** Word stems: "получил" also catches "получила", "зарплат" every case of "зарплата". */
const INCOME_WORDS = [
  'kirim', 'oylik', 'maosh', 'zarplata', 'daromad', 'bonus', 'avans', 'keldi', 'tushdi', 'oldim',
  'доход', 'зарплат', 'зп', 'премия', 'премию', 'бонус', 'аванс', 'получил', 'пришл', 'поступ',
];
const EXPENSE_WORDS = [
  'chiqim', 'xarajat', 'toʻladim', 'to‘ladim', "to'ladim", 'sotib', 'berdim', 'ketdi',
  'расход', 'потратил', 'купил', 'оплатил', 'заплатил',
];

/** Days back by word; "позавчера" is checked first, as it ends in "вчера". */
const DAY_WORDS: Array<[RegExp, number]> = [
  [/(^|\s)позавчера(\s|$)/iu, 2],
  [/(^|\s)(kecha|вчера)(\s|$)/iu, 1],
  [/(^|\s)(bugun|сегодня)(\s|$)/iu, 0],
];

// Longest first, so "тысяч" is not read as "тыс" followed by letters. A Cyrillic "к" counts
// only written onto the number ("45к"): apart, it is the preposition ("500 к чаю").
const UNIT_PATTERN = Object.keys(UNITS)
  .filter((unit) => unit !== 'к')
  .sort((a, b) => b.length - a.length)
  .join('|');

/**
 * number: either digit groups separated by space/dot/comma ("8 500 000", "50.000") or a plain run
 * of digits; optional 1–2 digit fraction (",50" or ".5"); optional unit word.
 */
const AMOUNT_RE = new RegExp(
  String.raw`(^|[\s(])([+-])?\s*(\d{1,3}(?:[ .,\u00A0\u202F]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?:\s*(${UNIT_PATTERN})|(к))?(?=$|[\s,.!?)])`,
  'iu',
);

function normalizeApostrophes(text: string): string {
  return text.replace(/[‘’ʼ`´]/g, "'");
}

function hasWord(text: string, words: string[]): boolean {
  const lower = normalizeApostrophes(text.toLowerCase());
  return words.some((w) => new RegExp(`(^|[^\\p{L}])${normalizeApostrophes(w)}`, 'u').test(lower));
}

export function parseQuickEntry(input: string): QuickEntry | null {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text || text.length > 300) return null;

  const match = AMOUNT_RE.exec(text);
  if (!match) return null;

  const [full, lead, sign, digits, fraction, unitApart, unitOnto] = match;
  const unitRaw = unitApart ?? unitOnto;
  const whole = BigInt(digits.replace(/[ .,\u00A0\u202F]/g, ''));
  const fracTiyin = fraction ? BigInt(fraction.padEnd(2, '0')) : 0n;
  const unit = unitRaw ? UNITS[unitRaw.toLowerCase()] : 1n;
  const amount = (whole * 100n + fracTiyin) * unit;
  if (amount <= 0n || amount >= MAX_TIYIN) return null;

  let note = (text.slice(0, match.index) + lead + text.slice(match.index + full.length))
    .replace(/\s+/g, ' ')
    .trim();

  let daysAgo = 0;
  const day = DAY_WORDS.find(([word]) => word.test(note));
  if (day) {
    daysAgo = day[1];
    note = note.replace(day[0], ' ').trim();
  }
  note = note
    .replace(/(^|\s)(so['‘’ʼ]?m|сум(?:а|ов)?|sum)(?=$|\s)/iu, ' ')
    .replace(/^[-–—:,.]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  let type: QuickEntry['type'] = 'EXPENSE';
  let typeExplicit = false;
  if (sign === '+' || (sign !== '-' && hasWord(note, INCOME_WORDS))) {
    type = 'INCOME';
    typeExplicit = true;
  } else if (sign === '-' || hasWord(note, EXPENSE_WORDS)) {
    typeExplicit = true;
  }

  return { type, amount, note: note.slice(0, 200), daysAgo, typeExplicit };
}
