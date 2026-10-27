import { AppLocale } from '@fintrack/shared';
import { BOT_TEXTS } from '../i18n';

export interface MonthlyReportData {
  /** The account's language: the text and the voice are both in it. */
  locale: AppLocale;
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

export const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const firstWord = (name: string, locale: AppLocale) =>
  name.trim().split(/\s+/)[0] || BOT_TEXTS[locale].reminders.friend;

/** Whole so‘m, to the thousand from ten thousand up: nobody listens to "… besh yuz o‘n ikki so‘m". */
export function roundedSom(tiyin: bigint): number {
  const som = Number((tiyin < 0n ? -tiyin : tiyin) / 100n);
  return som >= 10_000 ? Math.round(som / 1000) * 1000 : som;
}
