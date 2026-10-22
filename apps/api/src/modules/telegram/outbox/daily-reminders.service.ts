import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseIsoDate } from '@fintrack/shared';
import { UsersRepository } from '../../users/users.repository';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { ClockService } from '../../../infra/clock/clock.service';
import { ReminderKind, reminderKeyboard, reminderText } from './reminder-texts';

/** Stay well under Telegram's ~30 messages/second broadcast limit. */
const SEND_INTERVAL_MS = 50;

export interface ReminderSummary {
  kind: ReminderKind;
  recipients: number;
  sent: number;
}

/**
 * The 07:00 reminder to everyone who keeps reminders on, and the 22:00 one to those of them who
 * did not use FinTrack at all that day (bot, site or Mini App). Days are the app's time zone's,
 * as the activity records are.
 */
@Injectable()
export class DailyRemindersService {
  private readonly logger = new Logger(DailyRemindersService.name);
  private readonly timeZone: string;

  constructor(
    private readonly users: UsersRepository,
    private readonly telegram: TelegramBotService,
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Tashkent';
  }

  async run(kind: ReminderKind): Promise<ReminderSummary> {
    const day = this.clock.todayIn(this.timeZone);
    const recipients = await this.users.findReminderRecipients(kind === 'evening' ? parseIsoDate(day) : undefined);
    let sent = 0;

    for (const user of recipients) {
      if (user.telegramId === null) continue;
      // A retried job must not remind anyone twice the same day.
      if (!(await this.redis.setIfAbsent(`reminder:${kind}:${day}:${user.id}`, '1', 36 * 3600))) continue;

      try {
        const result = await this.telegram.send(user.telegramId, reminderText(kind, day, user.name), {
          html: true,
          replyMarkup: reminderKeyboard(),
        });
        if (result === 'SENT') sent++;
      } catch (err) {
        this.logger.warn(`${kind} reminder for ${user.id} failed: ${String(err)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    }
    return { kind, recipients: recipients.length, sent };
  }
}
