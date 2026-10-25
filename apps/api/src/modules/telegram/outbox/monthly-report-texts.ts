import { UZ_MONTHS, formatIsoDate, numberToWordsUz } from '@fintrack/shared';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { bar, money, periodLabel, signedMoney } from '../bot-ui';

export interface MonthlyReportData {
  /** First and last day of the month. */
  from: Date;
  to: Date;
  name: string;
  income: bigint;
  expense: bigint;
  /** Income and expense records; transfers and debts are not counted. */
  entries: number;
  /** The previous month's spending; null when nothing was spent then, as there is no comparison. */
  previous: { expense: bigint; changePercent: number } | null;
  top: Array<{ icon: string; name: string; amount: bigint; percent: number }>;
  budgets: { total: number; exceeded: Array<{ icon: string; name: string; percent: number }> };
  debts: { owedToMe: bigint; iOwe: bigint };
  totalBalance: bigint;
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const monthName = (date: Date) => UZ_MONTHS[date.getUTCMonth()];
const nextMonthName = (date: Date) => UZ_MONTHS[(date.getUTCMonth() + 1) % 12];
const firstWord = (name: string) => name.trim().split(/\s+/)[0] || 'do‘st';

function comparison(previous: MonthlyReportData['previous'], before: string): string | null {
  if (!previous) return null;
  const change = Math.round(previous.changePercent);
  if (change === 0) return `Chiqim ${before}dagidek`;
  return `Chiqim ${before}dagidan ${Math.abs(change)}% ${change > 0 ? 'ko‘p' : 'kam'}`;
}

export function monthlyReportText(d: MonthlyReportData): string {
  const before = UZ_MONTHS[(d.from.getUTCMonth() + 11) % 12];
  const lines = [
    `📅 <b>${capitalize(monthName(d.from))} oyi hisoboti</b>`,
    `${periodLabel(formatIsoDate(d.from), formatIsoDate(d.to))} · ${d.entries} ta yozuv`,
    '',
    `⬆️ Kirim: <b>${money(d.income)}</b>`,
    `⬇️ Chiqim: <b>${money(d.expense)}</b>`,
    `💵 Sof: <b>${signedMoney(d.income - d.expense)}</b>`,
  ];
  const compared = comparison(d.previous, before);
  if (compared) lines.push(`${d.previous && d.previous.changePercent > 0 ? '📈' : '📉'} ${compared}`);

  if (d.top.length > 0) {
    lines.push('', '<b>Eng ko‘p xarajat:</b>');
    for (const item of d.top) {
      lines.push(`${item.icon} ${escapeHtml(item.name)} — ${money(item.amount)} (${item.percent}%)\n${bar(item.percent)}`);
    }
  }

  if (d.budgets.total > 0) {
    const within = d.budgets.total - d.budgets.exceeded.length;
    lines.push('', `🎯 Byudjetlar: ${d.budgets.total} tadan ${within} tasi chegarada`);
    for (const b of d.budgets.exceeded) lines.push(`🔴 ${b.icon} ${escapeHtml(b.name)} — ${b.percent}%`);
  }

  lines.push('');
  if (d.debts.owedToMe > 0n) lines.push(`🤝 Sizga qaytarilishi kerak: <b>${money(d.debts.owedToMe)}</b>`);
  if (d.debts.iOwe > 0n) lines.push(`🤝 Siz qaytarishingiz kerak: <b>${money(d.debts.iOwe)}</b>`);
  lines.push(`💰 Umumiy balans: <b>${signedMoney(d.totalBalance)}</b>`);
  lines.push('', `✨ ${capitalize(nextMonthName(d.from))}da ham har bir xarajatni yozib boring!`);
  return lines.join('\n');
}

/** "qirq ikkita", "bitta": a count said aloud. */
function countWords(n: number): string {
  const words = numberToWordsUz(n);
  return words.endsWith('bir') ? `${words.slice(0, -3)}bitta` : `${words}ta`;
}

/** Whole so‘m, to the thousand from ten thousand up: nobody listens to "… besh yuz o‘n ikki so‘m". */
function roundedSom(tiyin: bigint): number {
  const som = Number((tiyin < 0n ? -tiyin : tiyin) / 100n);
  return som >= 10_000 ? Math.round(som / 1000) * 1000 : som;
}

const somWords = (som: number) => `${numberToWordsUz(Math.abs(som))} so‘m`;

export function spokenSom(tiyin: bigint): string {
  return somWords(roundedSom(tiyin));
}

/**
 * The same report for the voice message: plain sentences, numbers in words, no emoji or markup,
 * and only what is worth hearing (the top three categories, not five).
 */
export function monthlyReportScript(d: MonthlyReportData): string {
  const month = monthName(d.from);
  // From the rounded figures, so that what is heard adds up: income less spending is the rest.
  const net = roundedSom(d.income) - roundedSom(d.expense);
  const sentences = [
    `Salom, ${firstWord(d.name)}! ${capitalize(month)} oyi hisobotingiz tayyor.`,
    d.entries > 0 ? `Bu oy ${countWords(d.entries)} yozuv qildingiz.` : 'Bu oy hali yozuv qilmadingiz.',
  ];
  // "Kirim: nol so‘m" is not worth hearing.
  if (d.income > 0n || d.expense > 0n) {
    sentences.push(`Kirim: ${spokenSom(d.income)}. Chiqim: ${spokenSom(d.expense)}.`);
    if (net > 0) sentences.push(`Oy davomida ${somWords(net)} ortib qoldi.`);
    if (net < 0) sentences.push(`Chiqim kirimdan ${somWords(net)} ko‘p bo‘ldi.`);
  }

  if (d.previous) {
    const change = Math.round(d.previous.changePercent);
    const before = UZ_MONTHS[(d.from.getUTCMonth() + 11) % 12];
    sentences.push(
      change === 0
        ? `Chiqim ${before}dagidek bo‘ldi.`
        : `Chiqim ${before}dagidan ${numberToWordsUz(Math.abs(change))} foiz ${change > 0 ? 'ko‘p' : 'kam'}.`,
    );
  }

  const [first, ...rest] = d.top.slice(0, 3);
  if (first) {
    sentences.push(`Eng katta xarajat — ${first.name}: ${spokenSom(first.amount)}.`);
    // Each with its amount: a list joined with "va" runs into names like "Kafe va restoran".
    if (rest.length > 0) sentences.push(`Undan keyin: ${rest.map((r) => `${r.name} — ${spokenSom(r.amount)}`).join(', ')}.`);
  }

  if (d.budgets.total > 0) {
    const over = d.budgets.exceeded.length;
    sentences.push(
      over === 0
        ? 'Barcha byudjetlar chegarada qoldi.'
        : `Byudjetlardan ${countWords(over)}si oshib ketdi: ${d.budgets.exceeded.map((b) => b.name).join(', ')}.`,
    );
  }

  sentences.push(
    d.totalBalance >= 0n
      ? `Umumiy balansingiz: ${spokenSom(d.totalBalance)}.`
      : `Umumiy balansingiz manfiy: minus ${spokenSom(d.totalBalance)}.`,
    `${capitalize(nextMonthName(d.from))}da ham har bir xarajatni yozib boring. Omad!`,
  );
  return sentences.join(' ');
}
