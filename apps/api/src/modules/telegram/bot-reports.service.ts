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
import { bar, dayLabel, money, signedMoney } from './bot-ui';

export type ReportPeriod = 'today' | 'week' | 'month';

const PERIOD_TITLE: Record<ReportPeriod, string> = {
  today: 'Bugun',
  week: 'Shu hafta',
  month: 'Shu oy',
};

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
    const { data, meta } = await this.accounts.list(user.id);
    const lines = data.map((a) => {
      const warn = BigInt(a.balance) < 0n ? ' ⚠️' : '';
      return `${a.icon} ${escapeHtml(a.name)}: <b>${signedMoney(BigInt(a.balance))}</b>${warn}`;
    });
    return ['💰 <b>Balans</b>', '', ...lines, '', `Jami: <b>${signedMoney(BigInt(meta.totalBalance))}</b>`].join('\n');
  }

  async recent(user: User): Promise<string> {
    const { data } = await this.transactions.list(user.id, ListTransactionsQuerySchema.parse({ limit: 10 }));
    if (data.length === 0) return '📋 Hali hech qanday yozuv yo‘q. Boshlash uchun yozing: <code>50000 taksi</code>';

    const today = this.clock.todayIn(user.timezone);
    const lines = data.map((t) => {
      const sign = isUserManagedTransactionType(t.type) ? (t.type === 'INCOME' ? '+' : '−') : '';
      const label = t.category ? `${t.category.icon} ${escapeHtml(t.category.name)}` : escapeHtml(t.note ?? '');
      return `${TYPE_ICON[t.type] ?? '•'} ${sign}${money(t.amount)} — ${label} <i>(${dayLabel(t.date, today)})</i>`;
    });
    return ['📋 <b>Oxirgi amallar</b>', '', ...lines].join('\n');
  }

  async report(user: User, period: ReportPeriod): Promise<string> {
    const today = this.clock.todayIn(user.timezone);
    const from =
      period === 'today'
        ? today
        : formatIsoDate(period === 'week' ? startOfIsoWeek(parseIsoDate(today)) : startOfMonth(parseIsoDate(today)));
    return this.summaryText(user, PERIOD_TITLE[period], from, today);
  }

  /** Evening digest: identical to the "Bugun" report, with a nudge when nothing was logged. */
  async digest(user: User): Promise<string> {
    const today = this.clock.todayIn(user.timezone);
    return this.summaryText(user, '🌙 Kunlik xulosa', today, today, true);
  }

  async budgetsStatus(user: User): Promise<string> {
    const status = await this.budgets.getStatus(user.id);
    if (status.data.length === 0) {
      return '🎯 Bu oy uchun byudjet belgilanmagan. Uni ilovadagi “Byudjetlar” bo‘limida qo‘shishingiz mumkin.';
    }
    const lines = status.data.map((b) => {
      const icon = b.state === 'EXCEEDED' ? '🔴' : b.state === 'WARNING' ? '🟡' : '🟢';
      return `${icon} ${b.category.icon} ${escapeHtml(b.category.name)}\n${bar(b.percent)} ${b.percent}%\n${money(b.spent)} / ${money(b.limitAmount)}`;
    });
    return [`🎯 <b>Byudjet (${status.meta.month})</b>`, '', lines.join('\n\n')].join('\n');
  }

  private async summaryText(user: User, title: string, from: string, to: string, digest = false): Promise<string> {
    const [summary, byCategory] = await Promise.all([
      this.stats.getSummary(user.id, { from, to }),
      this.stats.getByCategory(user.id, { type: 'EXPENSE', from, to }),
    ]);
    const income = BigInt(summary.periodIncome);
    const expense = BigInt(summary.periodExpense);

    if (digest && summary.transactionCount === 0) {
      return `${title}\n\nBugun hech narsa yozilmadi. Xarajatlaringizni shu yerga yozishni unutmang 🙂`;
    }

    const lines = [
      `📊 <b>${title}</b>${from === to ? '' : ` (${from} – ${to})`}`,
      '',
      `⬆️ Kirim: <b>${money(income)}</b>`,
      `⬇️ Chiqim: <b>${money(expense)}</b>`,
      `💵 Sof: <b>${signedMoney(income - expense)}</b>`,
    ];
    const top = byCategory.items.slice(0, 5);
    if (top.length > 0) {
      lines.push('', '<b>Eng ko‘p xarajat:</b>');
      for (const item of top) {
        lines.push(`${item.icon} ${escapeHtml(item.name)} — ${money(item.amount)} (${item.percent}%)\n${bar(item.percent)}`);
      }
    }
    lines.push('', `💰 Umumiy balans: <b>${signedMoney(BigInt(summary.totalBalance))}</b>`);
    return lines.join('\n');
  }
}
