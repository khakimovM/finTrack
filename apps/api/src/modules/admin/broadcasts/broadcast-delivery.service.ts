import { Injectable, Logger } from '@nestjs/common';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { BroadcastsRepository, ClaimedRecipient, DeliveryOutcome } from './broadcasts.repository';

/** Telegram allows about 30 messages a second per bot; the rest is left for sign-in codes and alerts. */
export const BROADCAST_PER_SECOND = 25;
const RETRY_AFTER_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one broadcast: batches of 25 a second until nobody is waiting. Every row is claimed before
 * it is sent and never claimed again, so a retried or doubled run cannot message anyone twice.
 */
@Injectable()
export class BroadcastDeliveryService {
  private readonly logger = new Logger(BroadcastDeliveryService.name);

  constructor(
    private readonly repository: BroadcastsRepository,
    private readonly telegram: TelegramBotService,
  ) {}

  async deliver(id: string): Promise<void> {
    const broadcast = await this.repository.findById(id);
    if (!broadcast || broadcast.status === 'DONE') return;
    await this.repository.markStarted(id);
    await this.repository.failInterrupted(id);

    for (;;) {
      const started = Date.now();
      const batch = await this.repository.claim(id, BROADCAST_PER_SECOND);
      if (batch.length === 0) break;
      const outcomes = await Promise.all(batch.map((r) => this.sendOne(r, broadcast.text)));
      await this.repository.record(id, outcomes);
      await this.repository.refreshCounts(id, false);
      await sleep(Math.max(0, 1_000 - (Date.now() - started)));
    }

    const done = await this.repository.refreshCounts(id, true);
    this.logger.log(`Broadcast ${id} done: ${done.sent} sent, ${done.blocked} blocked, ${done.failed} failed of ${done.total}`);
  }

  /** Plain text, as written. A failure Telegram reports (429, network) gets one more try. */
  private async sendOne(recipient: ClaimedRecipient, text: string): Promise<DeliveryOutcome> {
    let result = await this.telegram.send(recipient.telegramId, text);
    if (result === 'FAILED') {
      await sleep(RETRY_AFTER_MS);
      result = await this.telegram.send(recipient.telegramId, text);
    }
    if (result === 'SENT') return { userId: recipient.userId, status: 'SENT' };
    if (result === 'BLOCKED') return { userId: recipient.userId, status: 'BLOCKED' };
    return { userId: recipient.userId, status: 'FAILED', error: result === 'DISABLED' ? 'bot_disabled' : 'telegram_error' };
  }
}
