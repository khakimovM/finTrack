import { UZ_MONTHS, formatIsoDate, numberToWordsUz } from '@fintrack/shared';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { bar, money, periodLabel, signedMoney } from '../bot-ui';
import { MonthlyReportData, capitalize, firstWord, roundedSom } from './monthly-report-data';
import { monthlyReportScriptRu, monthlyReportTextRu } from './monthly-report-texts.ru';

export type { MonthlyReportData } from './monthly-report-data';

const monthName = (date: Date) => UZ_MONTHS[date.getUTCMonth()];
const nextMonthName = (date: Date) => UZ_MONTHS[(date.getUTCMonth() + 1) % 12];

function comparison(previous: MonthlyReportData['previous'], before: string): string | null {
  if (!previous) return null;
  const change = Math.round(previous.changePercent);
  if (change === 0) return `Chiqim ${before}dagidek`;
  return `Chiqim ${before}dagidan ${Math.abs(change)}% ${change > 0 ? 'ko‘p' : 'kam'}`;
}

/** The month in the account's language; the Russian one is in monthly-report-texts.ru.ts. */
export function monthlyReportText(d: MonthlyReportData): string {
  return d.locale === 'ru' ? monthlyReportTextRu(d) : textUz(d);
}

export function monthlyReportScript(d: MonthlyReportData): string {
  return d.locale === 'ru' ? monthlyReportScriptRu(d) : scriptUz(d);
}

function textUz(d: MonthlyReportData): string {
  const before = UZ_MONTHS[(d.from.getUTCMonth() + 11) % 12];
  const lines = [
    `📅 <b>${capitalize(monthName(d.from))} oyi hisoboti</b>`,
    `${periodLabel(formatIsoDate(d.from), formatIsoDate(d.to), 'uz')} · ${d.entries} ta yozuv`,
    '',
    `⬆️ Kirim: <b>${money(d.income, 'uz')}</b>`,
    `⬇️ Chiqim: <b>${money(d.expense, 'uz')}</b>`,
    `💵 Sof: <b>${signedMoney(d.income - d.expense, 'uz')}</b>`,
  ];
  const compared = comparison(d.previous, before);
  if (compared) lines.push(`${d.previous && d.previous.changePercent > 0 ? '📈' : '📉'} ${compared}`);

  if (d.top.length > 0) {
    lines.push('', '<b>Eng ko‘p xarajat:</b>');
    for (const item of d.top) {
      lines.push(`${item.icon} ${escapeHtml(item.name)} — ${money(item.amount, 'uz')} (${item.percent}%)\n${bar(item.percent)}`);
    }
  }

  if (d.budgets.total > 0) {
    const within = d.budgets.total - d.budgets.exceeded.length;
    lines.push('', `🎯 Byudjetlar: ${d.budgets.total} tadan ${within} tasi chegarada`);
    for (const b of d.budgets.exceeded) lines.push(`🔴 ${b.icon} ${escapeHtml(b.name)} — ${b.percent}%`);
  }

  lines.push('');
  if (d.debts.owedToMe > 0n) lines.push(`🤝 Sizga qaytarilishi kerak: <b>${money(d.debts.owedToMe, 'uz')}</b>`);
  if (d.debts.iOwe > 0n) lines.push(`🤝 Siz qaytarishingiz kerak: <b>${money(d.debts.iOwe, 'uz')}</b>`);
  lines.push(`💰 Umumiy balans: <b>${signedMoney(d.totalBalance, 'uz')}</b>`);
  lines.push('', `✨ ${capitalize(nextMonthName(d.from))}da ham har bir xarajatni yozib boring!`);
  return lines.join('\n');
}

/** "qirq ikkita", "bitta": a count said aloud. */
function countWords(n: number): string {
  const words = numberToWordsUz(n);
  return words.endsWith('bir') ? `${words.slice(0, -3)}bitta` : `${words}ta`;
}

const somWords = (som: number) => `${numberToWordsUz(Math.abs(som))} so‘m`;

export function spokenSom(tiyin: bigint): string {
  return somWords(roundedSom(tiyin));
}

/**
 * The same report for the voice message: plain sentences, numbers in words, no emoji or markup,
 * and only what is worth hearing (the top three categories, not five).
 */
function scriptUz(d: MonthlyReportData): string {
  const month = monthName(d.from);
  // From the rounded figures, so that what is heard adds up: income less spending is the rest.
  const net = roundedSom(d.income) - roundedSom(d.expense);
  const sentences = [
    `Salom, ${firstWord(d.name, 'uz')}! ${capitalize(month)} oyi hisobotingiz tayyor.`,
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
