import { MONTHS_STANDALONE, formatIsoDate, numberToWordsRu, plural } from '@fintrack/shared';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { bar, money, periodLabel, signedMoney } from '../bot-ui';
import { MonthlyReportData, firstWord, roundedSom } from './monthly-report-data';

/** "в октябре": the month after "в", which neither the standalone nor the date form gives. */
const MONTHS_PREPOSITIONAL = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
];

const ENTRY = { one: 'запись', few: 'записи', many: 'записей', other: 'записи' };
const PERCENT = { one: 'процент', few: 'процента', many: 'процентов', other: 'процента' };
const SUM = { one: 'сум', few: 'сума', many: 'сумов', other: 'сума' };

const month = (date: Date) => MONTHS_STANDALONE.ru[date.getUTCMonth()];
const monthBefore = (date: Date) => MONTHS_PREPOSITIONAL[(date.getUTCMonth() + 11) % 12];
const monthAfter = (date: Date) => MONTHS_PREPOSITIONAL[(date.getUTCMonth() + 1) % 12];

function comparison(previous: MonthlyReportData['previous'], before: string): string | null {
  if (!previous) return null;
  const change = Math.round(previous.changePercent);
  if (change === 0) return `Расходы — как в ${before}`;
  return `Расходы на ${Math.abs(change)}% ${change > 0 ? 'больше' : 'меньше'}, чем в ${before}`;
}

export function monthlyReportTextRu(d: MonthlyReportData): string {
  const l = 'ru';
  const lines = [
    `📅 <b>Отчёт за ${month(d.from)}</b>`,
    `${periodLabel(formatIsoDate(d.from), formatIsoDate(d.to), l)} · ${d.entries} ${plural(l, d.entries, ENTRY)}`,
    '',
    `⬆️ Доход: <b>${money(d.income, l)}</b>`,
    `⬇️ Расход: <b>${money(d.expense, l)}</b>`,
    `💵 Чистый итог: <b>${signedMoney(d.income - d.expense, l)}</b>`,
  ];
  const compared = comparison(d.previous, monthBefore(d.from));
  if (compared) lines.push(`${d.previous && d.previous.changePercent > 0 ? '📈' : '📉'} ${compared}`);

  if (d.top.length > 0) {
    lines.push('', '<b>Больше всего потрачено:</b>');
    for (const item of d.top) {
      lines.push(`${item.icon} ${escapeHtml(item.name)} — ${money(item.amount, l)} (${item.percent}%)\n${bar(item.percent)}`);
    }
  }

  if (d.budgets.total > 0) {
    const within = d.budgets.total - d.budgets.exceeded.length;
    lines.push('', `🎯 Бюджеты: в пределах лимита ${within} из ${d.budgets.total}`);
    for (const b of d.budgets.exceeded) lines.push(`🔴 ${b.icon} ${escapeHtml(b.name)} — ${b.percent}%`);
  }

  lines.push('');
  if (d.debts.owedToMe > 0n) lines.push(`🤝 Вам должны вернуть: <b>${money(d.debts.owedToMe, l)}</b>`);
  if (d.debts.iOwe > 0n) lines.push(`🤝 Вам нужно вернуть: <b>${money(d.debts.iOwe, l)}</b>`);
  lines.push(`💰 Общий баланс: <b>${signedMoney(d.totalBalance, l)}</b>`);
  lines.push('', `✨ В ${monthAfter(d.from)} тоже записывайте каждый расход!`);
  return lines.join('\n');
}

const sumWords = (som: number) => `${numberToWordsRu(Math.abs(som))} ${plural('ru', Math.abs(som), SUM)}`;

export function spokenSum(tiyin: bigint): string {
  return sumWords(roundedSom(tiyin));
}

/** The Russian voice script: the same rules as the Uzbek one (words, no markup, top three). */
export function monthlyReportScriptRu(d: MonthlyReportData): string {
  const net = roundedSom(d.income) - roundedSom(d.expense);
  const entries = `${numberToWordsRu(d.entries, 'feminine')} ${plural('ru', d.entries, ENTRY)}`;
  const sentences = [
    `Привет, ${firstWord(d.name, 'ru')}! Отчёт за ${month(d.from)} готов.`,
    d.entries > 0 ? `В этом месяце у вас ${entries}.` : 'В этом месяце записей пока нет.',
  ];
  if (d.income > 0n || d.expense > 0n) {
    sentences.push(`Доход: ${spokenSum(d.income)}. Расход: ${spokenSum(d.expense)}.`);
    if (net > 0) sentences.push(`За месяц осталось ${sumWords(net)}.`);
    if (net < 0) sentences.push(`Расходы превысили доходы на ${sumWords(net)}.`);
  }

  if (d.previous) {
    const change = Math.abs(Math.round(d.previous.changePercent));
    const before = monthBefore(d.from);
    sentences.push(
      change === 0
        ? `Расходы такие же, как в ${before}.`
        : `Расходы на ${numberToWordsRu(change)} ${plural('ru', change, PERCENT)} ${d.previous.changePercent > 0 ? 'больше' : 'меньше'}, чем в ${before}.`,
    );
  }

  const [first, ...rest] = d.top.slice(0, 3);
  if (first) {
    sentences.push(`Больше всего ушло на категорию «${first.name}»: ${spokenSum(first.amount)}.`);
    if (rest.length > 0) sentences.push(`Дальше: ${rest.map((r) => `${r.name} — ${spokenSum(r.amount)}`).join(', ')}.`);
  }

  if (d.budgets.total > 0) {
    const over = d.budgets.exceeded.length;
    sentences.push(
      over === 0
        ? 'Все бюджеты остались в пределах лимита.'
        : `Превышено бюджетов: ${numberToWordsRu(over)} — ${d.budgets.exceeded.map((b) => b.name).join(', ')}.`,
    );
  }

  sentences.push(
    d.totalBalance >= 0n
      ? `Ваш общий баланс: ${spokenSum(d.totalBalance)}.`
      : `Ваш общий баланс отрицательный: минус ${spokenSum(d.totalBalance)}.`,
    `В ${monthAfter(d.from)} тоже записывайте каждый расход. Удачи!`,
  );
  return sentences.join(' ');
}
