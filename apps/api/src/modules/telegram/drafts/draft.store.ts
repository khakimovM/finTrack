import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from '../../../infra/redis/redis.service';

/** Nothing is written to the ledger from chat until the user presses "Saqlash" on a draft. */
export interface TransactionDraft {
  kind: 'transaction';
  id: string;
  userId: string;
  type: 'INCOME' | 'EXPENSE';
  /** Tiyin as a string (JSON has no bigint). */
  amount: string;
  note: string;
  categoryId: string | null;
  accountId: string;
  date: string;
  source: 'text' | 'voice';
}

export interface DebtPaymentDraft {
  kind: 'debt-payment';
  id: string;
  userId: string;
  debtId: string;
  /** null = settle whatever remains. */
  amount: string | null;
  accountId: string;
}

export type Draft = TransactionDraft | DebtPaymentDraft;
type NewDraft = Omit<TransactionDraft, 'id'> | Omit<DebtPaymentDraft, 'id'>;

/** What the next plain text message from this user answers. */
export type AwaitingState =
  | { kind: 'debt-payment-amount'; debtId: string }
  | { kind: 'entry'; type: 'INCOME' | 'EXPENSE' };

const DRAFT_TTL_SECONDS = 30 * 60;
const AWAIT_TTL_SECONDS = 10 * 60;

@Injectable()
export class DraftStore {
  constructor(private readonly redis: RedisService) {}

  /** Short ids keep callback_data under Telegram's 64-byte limit. */
  async create<T extends NewDraft>(draft: T): Promise<T & { id: string }> {
    const saved = { ...draft, id: randomBytes(6).toString('base64url') };
    await this.redis.set(this.key(saved.userId, saved.id), JSON.stringify(saved), DRAFT_TTL_SECONDS);
    return saved;
  }

  /**
   * The owner is part of the key, so a forged callback carrying someone else's draft id finds
   * nothing: it can neither read nor consume (destroy) that draft.
   */
  async get(id: string, userId: string): Promise<Draft | null> {
    const raw = await this.redis.get(this.key(userId, id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  }

  async save(draft: Draft): Promise<void> {
    await this.redis.set(this.key(draft.userId, draft.id), JSON.stringify(draft), DRAFT_TTL_SECONDS);
  }

  /** Atomically removes the draft; returns null if it was already consumed (double tap). */
  async consume(id: string, userId: string): Promise<Draft | null> {
    const raw = await this.redis.take(this.key(userId, id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  }

  async setAwaiting(telegramId: number, state: AwaitingState): Promise<void> {
    await this.redis.set(`tg:await:${telegramId}`, JSON.stringify(state), AWAIT_TTL_SECONDS);
  }

  async takeAwaiting(telegramId: number): Promise<AwaitingState | null> {
    const raw = await this.redis.take(`tg:await:${telegramId}`);
    return raw ? (JSON.parse(raw) as AwaitingState) : null;
  }

  private key(userId: string, id: string): string {
    return `tg:draft:${userId}:${id}`;
  }
}
