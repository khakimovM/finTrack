import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationType } from '@prisma/client';
import { NotificationsRepository } from '../../notifications/notifications.repository';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { JOBS, QUEUES } from '../../../infra/queue/queues';

const ICONS: Record<NotificationType, string> = {
  BUDGET_WARNING: '🟡',
  BUDGET_EXCEEDED: '🔴',
  DEBT_DUE_SOON: '⏰',
  DEBT_OVERDUE: '🔴',
  NEGATIVE_BALANCE: '⚠️',
  RECURRING_CREATED: '🔁',
  RECURRING_SKIPPED: '⚠️',
};

export type OutboxResult = 'SENT' | 'SKIPPED' | 'BLOCKED';

/**
 * Delivers in-app notifications to Telegram. The limiter keeps the bot under Telegram's
 * ~30 messages/second; failures (429, network) throw so BullMQ retries with backoff.
 */
@Processor(QUEUES.TELEGRAM_OUTBOX, { limiter: { max: 25, duration: 1000 } })
export class TelegramOutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramOutboxProcessor.name);

  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly telegram: TelegramBotService,
  ) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<OutboxResult> {
    if (job.name !== JOBS.DELIVER_NOTIFICATION) return 'SKIPPED';
    const notification = await this.notifications.findForDelivery(job.data.notificationId);
    const user = notification?.user;
    if (
      !notification ||
      !user ||
      notification.telegramSentAt ||
      user.deletedAt ||
      user.telegramId === null ||
      !user.notifyTelegram ||
      user.telegramBlockedAt
    ) {
      return 'SKIPPED';
    }

    const text = `${ICONS[notification.type]} <b>${escapeHtml(notification.title)}</b>\n${escapeHtml(notification.body)}`;
    const result = await this.telegram.send(user.telegramId, text, { html: true });
    if (result === 'FAILED') throw new Error('Telegram delivery failed, will retry');
    if (result === 'SENT') await this.notifications.markTelegramSent(notification.id);
    return result === 'BLOCKED' ? 'BLOCKED' : 'SENT';
  }
}
