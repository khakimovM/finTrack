import { Injectable, Logger } from '@nestjs/common';
import { BotReportsService } from '../bot-reports.service';
import { UsersRepository } from '../../users/users.repository';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { ClockService } from '../../../infra/clock/clock.service';

/** Stay well under Telegram's ~30 messages/second broadcast limit. */
const SEND_INTERVAL_MS = 50;

export interface DigestSummary {
  recipients: number;
  sent: number;
}

@Injectable()
export class DailyDigestService {
  private readonly logger = new Logger(DailyDigestService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly reports: BotReportsService,
    private readonly telegram: TelegramBotService,
    private readonly redis: RedisService,
    private readonly clock: ClockService,
  ) {}

  async run(): Promise<DigestSummary> {
    const recipients = await this.users.findDigestRecipients();
    let sent = 0;

    for (const user of recipients) {
      if (user.telegramId === null) continue;
      // A retried job must not send the same day's digest twice.
      const day = this.clock.todayIn(user.timezone);
      if (!(await this.redis.setIfAbsent(`digest:${user.id}:${day}`, '1', 36 * 3600))) continue;

      try {
        const text = await this.reports.digest(user);
        if ((await this.telegram.send(user.telegramId, text, { html: true })) === 'SENT') sent++;
      } catch (err) {
        this.logger.warn(`Digest for ${user.id} failed: ${String(err)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    }
    return { recipients: recipients.length, sent };
  }
}
