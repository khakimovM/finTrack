import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { formatIsoDate } from '@fintrack/shared';
import { MonthRange, UsersRepository, monthOf } from '../../users/users.repository';
import { StatsService } from '../../stats/stats.service';
import { BudgetsService } from '../../budgets/budgets.service';
import { SendResult, TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { TtsService } from '../../../infra/tts/tts.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { MonthlyReportData, monthlyReportScript, monthlyReportText } from './monthly-report-texts';
import { categoryName } from '../bot-reports.service';
import { BOT_TEXTS, userLocale } from '../i18n';

/** Stay well under Telegram's ~30 messages/second broadcast limit. */
const SEND_INTERVAL_MS = 50;

export interface MonthlyDelivery {
  text: SendResult;
  /** The provider that read it, or null when only the text went. */
  voice: string | null;
}

export interface MonthlySummary {
  month: string;
  recipients: number;
  sent: number;
  voiced: number;
  providers: Record<string, number>;
}

/**
 * The month's report on its last day at 21:00 (in place of that evening's digest): the figures
 * as a message, then the same read aloud. A voice that cannot be made never holds the text back.
 */
@Injectable()
export class MonthlyReportService {
  private readonly logger = new Logger(MonthlyReportService.name);
  private readonly timeZone: string;

  constructor(
    private readonly users: UsersRepository,
    private readonly stats: StatsService,
    private readonly budgets: BudgetsService,
    private readonly telegram: TelegramBotService,
    private readonly tts: TtsService,
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Tashkent';
  }

  async run(): Promise<MonthlySummary> {
    const month = monthOf(this.clock.todayIn(this.timeZone));
    const label = formatIsoDate(month.from).slice(0, 7);
    const recipients = await this.users.findMonthlyRecipients(month);
    const summary: MonthlySummary = { month: label, recipients: recipients.length, sent: 0, voiced: 0, providers: {} };

    for (const user of recipients) {
      // A retried job must not send anyone the same month twice.
      if (!(await this.redis.setIfAbsent(`monthly:${label}:${user.id}`, '1', 40 * 24 * 3600))) continue;
      try {
        const delivery = await this.deliver(user, month);
        if (delivery.text === 'SENT') summary.sent++;
        if (delivery.voice) {
          summary.voiced++;
          summary.providers[delivery.voice] = (summary.providers[delivery.voice] ?? 0) + 1;
        }
      } catch (err) {
        this.logger.warn(`Monthly report for ${user.id} failed: ${String(err)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    }
    return summary;
  }

  /** The current month so far, to the owner on request (/oylik): how the report reads and sounds. */
  async preview(user: User): Promise<MonthlyDelivery> {
    return this.deliver(user, monthOf(this.clock.todayIn(this.timeZone)));
  }

  private async deliver(user: User, month: MonthRange): Promise<MonthlyDelivery> {
    if (user.telegramId === null) return { text: 'FAILED', voice: null };
    const data = await this.collect(user, month);
    const text = await this.telegram.send(user.telegramId, monthlyReportText(data), { html: true });
    if (text !== 'SENT') return { text, voice: null };

    const speech = await this.tts.speak(monthlyReportScript(data), data.locale);
    if (!speech) return { text, voice: null };
    const caption = BOT_TEXTS[data.locale].monthly.voiceCaption;
    const voice = await this.telegram.sendVoice(user.telegramId, speech.audio, { caption });
    return { text, voice: voice === 'SENT' ? speech.provider : null };
  }

  private async collect(user: User, month: MonthRange): Promise<MonthlyReportData> {
    const from = formatIsoDate(month.from);
    const to = formatIsoDate(month.to);
    const [summary, byCategory, budgets] = await Promise.all([
      this.stats.getSummary(user.id, { from, to }),
      this.stats.getByCategory(user.id, { type: 'EXPENSE', from, to }),
      this.budgets.getStatus(user.id, from.slice(0, 7)),
    ]);
    const previousExpense = BigInt(summary.previousPeriod.expense);

    return {
      locale: userLocale(user),
      from: month.from,
      to: month.to,
      name: user.name,
      income: BigInt(summary.periodIncome),
      expense: BigInt(summary.periodExpense),
      entries: summary.transactionCount,
      previous: previousExpense > 0n ? { expense: previousExpense, changePercent: summary.previousPeriod.changePercent } : null,
      top: byCategory.items.slice(0, 5).map((item) => ({
        icon: item.icon,
        name: categoryName(item, user),
        amount: BigInt(item.amount),
        percent: item.percent,
      })),
      budgets: {
        total: budgets.data.length,
        exceeded: budgets.data
          .filter((b) => b.state === 'EXCEEDED')
          .map((b) => ({ icon: b.category.icon, name: b.category.name, percent: b.percent })),
      },
      debts: { owedToMe: BigInt(summary.debt.owedToMe), iOwe: BigInt(summary.debt.iOwe) },
      totalBalance: BigInt(summary.totalBalance),
    };
  }
}
