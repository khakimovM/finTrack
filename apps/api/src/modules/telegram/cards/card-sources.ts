import { createHash } from 'crypto';
import type { MessageOrigin } from 'grammy/types';
import { CardNetwork, CardOperation } from './card-message.parser';

/**
 * The official notification bots, by Telegram user id. A forward carries its origin as Telegram's
 * server recorded it, so the sender cannot be made up by the person forwarding.
 */
const CARD_BOTS: Readonly<Record<number, CardNetwork>> = {
  915326936: 'UZCARD', // CardXabar
};

/** Bots not listed by id yet are still recognised by name (Humo's bot id is not known yet). */
const BOT_USERNAMES: ReadonlyArray<{ pattern: RegExp; network: CardNetwork }> = [
  { pattern: /humo/i, network: 'HUMO' },
  { pattern: /uzcard|cardxabar/i, network: 'UZCARD' },
];

/**
 * The network of a forwarded card notification, or null when the message did not come from a
 * bot. Only bots count: a person's own text that merely looks like a notification is not one.
 */
export function cardNetworkOf(origin: MessageOrigin | undefined, text: string): CardNetwork | null {
  if (origin?.type !== 'user' || !origin.sender_user.is_bot) return null;
  const listed = CARD_BOTS[origin.sender_user.id];
  if (listed) return listed;
  const username = origin.sender_user.username ?? '';
  const byName = BOT_USERNAMES.find(({ pattern }) => pattern.test(username));
  if (byName) return byName.network;
  // Another bot in the same format: Humo names its cards, Uzcard masks them with asterisks.
  if (/HUMO/i.test(text)) return 'HUMO';
  return /\*{3}\d{4}/.test(text) ? 'UZCARD' : null;
}

/** The moment of the operation: the banks write Tashkent time (UTC+5, no daylight saving). */
export function operationInstant(op: Pick<CardOperation, 'date' | 'time'>): Date {
  return new Date(`${op.date}T${op.time}:00+05:00`);
}

/**
 * The same notification forwarded again, by anyone and any number of times, hashes the same;
 * two purchases of the same amount in the same minute still differ by the balance after them.
 */
export function operationFingerprint(op: CardOperation): string {
  const parts = [
    op.network,
    op.last4,
    op.date,
    op.time,
    op.direction,
    op.amount.toString(),
    op.balanceAfter?.toString() ?? '-',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
