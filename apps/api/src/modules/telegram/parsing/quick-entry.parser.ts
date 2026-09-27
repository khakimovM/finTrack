/**
 * Deterministic parser for chat-style entries: "50000 taksi", "taksiga 20 ming", "1,5 mln ijara",
 * "+8 500 000 oylik", "kecha 45k tushlik". Anything it cannot read confidently returns null and
 * is handed to the AI extractor instead — a wrong amount is worse than asking again.
 */

export interface QuickEntry {
  type: 'INCOME' | 'EXPENSE';
  /** Amount in tiyin. */
  amount: bigint;
  note: string;
  /** Days before today (0 = today, 1 = "kecha"). */
  daysAgo: number;
  /** True when the type came from an explicit sign or keyword rather than the default. */
  typeExplicit: boolean;
}

const MAX_TIYIN = 10n ** 18n;

const UNITS: Record<string, bigint> = {
  k: 1_000n,
  ming: 1_000n,
  m: 1_000_000n,
  mln: 1_000_000n,
  million: 1_000_000n,
  mlrd: 1_000_000_000n,
};

const INCOME_WORDS = ['kirim', 'oylik', 'maosh', 'zarplata', 'daromad', 'bonus', 'avans', 'keldi', 'tushdi', 'oldim'];
const EXPENSE_WORDS = ['chiqim', 'xarajat', 'toʻladim', 'to‘ladim', "to'ladim", 'sotib', 'berdim', 'ketdi'];

/**
 * number: either digit groups separated by space/dot/comma ("8 500 000", "50.000") or a plain run
 * of digits; optional 1–2 digit fraction (",50" or ".5"); optional unit word.
 */
const AMOUNT_RE =
  /(^|[\s(])([+-])?\s*(\d{1,3}(?:[ .,\u00A0\u202F]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(mlrd|million|mln|ming|k|m)?(?=$|[\s,.!?)])/iu;

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

  const [full, lead, sign, digits, fraction, unitRaw] = match;
  const whole = BigInt(digits.replace(/[ .,\u00A0\u202F]/g, ''));
  const fracTiyin = fraction ? BigInt(fraction.padEnd(2, '0')) : 0n;
  const unit = unitRaw ? UNITS[unitRaw.toLowerCase()] : 1n;
  const amount = (whole * 100n + fracTiyin) * unit;
  if (amount <= 0n || amount >= MAX_TIYIN) return null;

  let note = (text.slice(0, match.index) + lead + text.slice(match.index + full.length))
    .replace(/\s+/g, ' ')
    .trim();

  let daysAgo = 0;
  if (/(^|\s)kecha(\s|$)/i.test(note)) {
    daysAgo = 1;
    note = note.replace(/(^|\s)kecha(\s|$)/i, ' ').trim();
  } else if (/(^|\s)bugun(\s|$)/i.test(note)) {
    note = note.replace(/(^|\s)bugun(\s|$)/i, ' ').trim();
  }
  note = note
    .replace(/(^|\s)(so['‘’ʼ]?m|сум|sum)(?=$|\s)/iu, ' ')
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
