import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import {
  ListTransactionsQuerySchema,
  formatIsoDate,
  isUserManagedTransactionType,
  parseIsoDate,
  startOfIsoWeek,
  startOfMonth,
} from '@fintrack/shared';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { StatsService } from '../stats/stats.service';
import { BudgetsService } from '../budgets/budgets.service';
import { ClockService } from '../../infra/clock/clock.service';
import { escapeHtml } from '../auth/telegram-login.messages';
import { bar, dayLabel, money, periodLabel, signedMoney } from './bot-ui';
import { BOT_TEXTS, userLocale } from './i18n';

export type ReportPeriod = 'today' | 'week' | 'month';

const TYPE_ICON: Record<string, string> = {
  INCOME: '➕',
  EXPENSE: '➖',
  TRANSFER_IN: '🔁',
  TRANSFER_OUT: '🔁',
  LOAN_GIVEN: '🤝',
  LOAN_TAKEN: '🤝',
  LOAN_REPAY_IN: '🤝',
  LOAN_REPAY_OUT: '🤝',
  ADJUSTMENT: '⚖️',
};

/**
 * A category of a report. The stats name the uncategorised share themselves (in Uzbek, and
 * cached for everyone), so the reader's language names it here.
 */
export function categoryName(item: { categoryId: string | null; name: string }, user: Pick<User, 'locale'>): string {
  return item.categoryId === null ? BOT_TEXTS[userLocale(user)].common.otherCategory : item.name;
}

/** Read-only chat views. All numbers come from the same services as the web dashboard. */
@Injectable()
export class BotReportsService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly transactions: TransactionsService,
    private readonly stats: StatsService,
    private readonly budgets: BudgetsService,
    private readonly clock: ClockService,
  ) {}

  async balance(user: User): Promise<string> {
    const locale = userLocale(user);
    const t = BOT_TEXTS[locale].reports;
    const { data, meta } = await this.accounts.list(user.id, true);
    // An archived account still holds its money and is in the total; listed, the lines add up to it.
    const shown = data.filter((a) => a.archivedAt === null || BigInt(a.balance) !== 0n);
    const lines = shown.map((a) => {
      const warn = BigInt(a.balance) < 0n ? ' ⚠️' : '';
      const archived = a.archivedAt === null ? '' : ` <i>(${t.archived})</i>`;
      return `${a.icon} ${escapeHtml(a.name)}${archived}: <b>${signedMoney(BigInt(a.balance), locale)}</b>${warn}`;
    });
    return [t.balanceTitle, '', ...lines, '', `${t.total}: <b>${signedMoney(BigInt(meta.totalBalance), locale)}</b>`].join('\n');
  }

  async recent(user: User): Promise<string> {
    const locale = userLocale(user);
    const t = BOT_TEXTS[locale].reports;
    const { data } = await this.transactions.list(user.id, ListTransactionsQuerySchema.parse({ limit: 10 }));
    if (data.length === 0) return t.recentEmpty;

    const today = this.clock.todayIn(user.timezone);
    const lines = data.map((tx) => {
      const sign = isUserManagedTransactionType(tx.type) ? (tx.type === 'INCOME' ? '+' : '−') : '';
      const label = tx.category ? `${tx.category.icon} ${escapeHtml(tx.category.name)}` : escapeHtml(tx.note ?? '');
      return `${TYPE_ICON[tx.type] ?? '•'} ${sign}${money(tx.amount, locale)} — ${label} <i>(${dayLabel(tx.date, today, locale)})</i>`;
    });
    return [t.recentTitle, '', ...lines].join('\n');
  }

  async report(user: User, period: ReportPeriod): Promise<string> {
    const today = this.clock.todayIn(user.timezone);
    const from =
      period === 'today'
        ? today
        : formatIsoDate(period === 'week' ? startOfIsoWeek(parseIsoDate(today)) : startOfMonth(parseIsoDate(today)));
    return this.summaryText(user, BOT_TEXTS[userLocale(user)].reports.period[period], from, today);
  }

  /** Evening digest: identical to the "today" report, with a nudge when nothing was logged. */
  async digest(user: User): Promise<string> {
    const today = this.clock.todayIn(user.timezone);
    return this.summaryText(user, BOT_TEXTS[userLocale(user)].reports.digestTitle, today, today, true);
  }

  async budgetsStatus(user: User): Promise<string> {
    const locale = userLocale(user);
    const t = BOT_TEXTS[locale].reports;
    const status = await this.budgets.getStatus(user.id);
    if (status.data.length === 0) return t.budgetsEmpty;
    const lines = status.data.map((b) => {
      const icon = b.state === 'EXCEEDED' ? '🔴' : b.state === 'WARNING' ? '🟡' : '🟢';
      return `${icon} ${b.category.icon} ${escapeHtml(b.category.name)}\n${bar(b.percent)} ${b.percent}%\n${money(b.spent, locale)} / ${money(b.limitAmount, locale)}`;
    });
    return [t.budgetsTitle(status.meta.month), '', lines.join('\n\n')].join('\n');
  }

  private async summaryText(user: User, title: string, from: string, to: string, digest = false): Promise<string> {
    const locale = userLocale(user);
    const t = BOT_TEXTS[locale].reports;
    const [summary, byCategory] = await Promise.all([
      this.stats.getSummary(user.id, { from, to }),
      this.stats.getByCategory(user.id, { type: 'EXPENSE', from, to }),
    ]);
    const income = BigInt(summary.periodIncome);
    const expense = BigInt(summary.periodExpense);

    // transactionCount is income and expense only: a day of transfers or debts was not empty.
    if (digest && summary.transactionCount === 0 && !(await this.recordedAnything(user, from, to))) {
      return `${title}\n\n${t.digestEmpty}`;
    }

    const lines = [
      `📊 <b>${title}</b>${from === to ? '' : ` (${periodLabel(from, to, locale)})`}`,
      '',
      `⬆️ ${t.income}: <b>${money(income, locale)}</b>`,
      `⬇️ ${t.expense}: <b>${money(expense, locale)}</b>`,
      `💵 ${t.net}: <b>${signedMoney(income - expense, locale)}</b>`,
    ];
    const top = byCategory.items.slice(0, 5);
    if (top.length > 0) {
      lines.push('', `<b>${t.topExpenses}:</b>`);
      for (const item of top) {
        lines.push(
          `${item.icon} ${escapeHtml(categoryName(item, user))} — ${money(item.amount, locale)} (${item.percent}%)\n${bar(item.percent)}`,
        );
      }
    }
    lines.push('', `💰 ${t.totalBalance}: <b>${signedMoney(BigInt(summary.totalBalance), locale)}</b>`);
    return lines.join('\n');
  }

  /** Any ledger row in the range: transfers and debt movements too. */
  private async recordedAnything(user: User, from: string, to: string): Promise<boolean> {
    const { meta } = await this.transactions.list(user.id, ListTransactionsQuerySchema.parse({ from, to, limit: 1 }));
    return meta.total > 0;
  }
}
