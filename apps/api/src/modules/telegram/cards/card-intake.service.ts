import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { User } from '@prisma/client';
import { parseIsoDate } from '@fintrack/shared';
import { CardNetwork, parseCardMessage } from './card-message.parser';
import { operationFingerprint, operationInstant } from './card-sources';
import { CardImportRepository } from './card-import.repository';
import { CardImportService } from './card-import.service';
import { JOBS, QUEUES } from '../../../infra/queue/queues';
import { RedisService } from '../../../infra/redis/redis.service';

/**
 * Telegram delivers a multi-message forward as separate updates, a few per second. Each one
 * pushes the summary back by this much, so the whole burst gets one summary.
 */
export const CARD_BURST_QUIET_MS = 3_000;
const COUNTER_TTL_SECONDS = 3600;

type Counter = 'ignored' | 'repeated';

/** Forwarded notification → stored operation; a quiet moment later → one import and its summary. */
@Injectable()
export class CardIntakeService {
  constructor(
    private readonly repository: CardImportRepository,
    private readonly imports: CardImportService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUES.CARD_IMPORT) private readonly queue: Queue,
  ) {}

  async ingest(user: User, text: string, network: CardNetwork): Promise<void> {
    const parsed = parseCardMessage(text, network);
    if (parsed.kind === 'ignored') {
      await this.count(user.id, 'ignored');
    } else {
      const op = parsed.operation;
      const card = await this.repository.upsertCard(user.id, op.network, op.last4);
      const outcome = await this.repository.addOperation(user.id, card.id, {
        fingerprint: operationFingerprint(op),
        direction: op.direction,
        amount: op.amount,
        merchant: op.merchant.slice(0, 200),
        label: op.label.slice(0, 100),
        occurredAt: operationInstant(op),
        date: parseIsoDate(op.date),
        balanceAfter: op.balanceAfter,
        reversal: op.reversal,
      });
      if (outcome === 'repeated') await this.count(user.id, 'repeated');
    }
    await this.schedule(user.id);
  }

  /** Debounced: a later forward replaces the waiting job and starts the quiet period again. */
  async schedule(userId: string): Promise<void> {
    await this.queue.add(
      JOBS.FLUSH_CARD_IMPORT,
      { userId },
      {
        delay: CARD_BURST_QUIET_MS,
        deduplication: { id: `card-import:${userId}`, ttl: CARD_BURST_QUIET_MS, extend: true, replace: true },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    );
  }

  /** Gathers what arrived into one import and sends its first screen. Returns the import's id. */
  async flush(userId: string): Promise<string | null> {
    const ignored = await this.take(userId, 'ignored');
    const repeated = await this.take(userId, 'repeated');
    const importId = await this.repository.claim(userId, { ignored, repeated });
    if (importId) await this.imports.present(userId, importId);
    return importId;
  }

  private async count(userId: string, counter: Counter): Promise<void> {
    await this.redis.incrWithTtl(`card:${counter}:${userId}`, COUNTER_TTL_SECONDS);
  }

  private async take(userId: string, counter: Counter): Promise<number> {
    return Number((await this.redis.take(`card:${counter}:${userId}`)) ?? 0) || 0;
  }
}
