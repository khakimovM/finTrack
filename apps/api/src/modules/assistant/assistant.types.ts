import { addDays, formatIsoDate, parseIsoDate, positiveTiyinSchema, somToTiyin } from '@fintrack/shared';
import { Extraction } from './extraction.schema';

export type ProviderName = 'gemini' | 'groq' | 'claude';

/**
 * rate_limited: quota or 429 (switch provider, cool down); unavailable: network/5xx/timeout;
 * rejected: the provider refused the input; bad_output: the answer did not match the schema.
 */
export type ProviderFailure = 'rate_limited' | 'unavailable' | 'rejected' | 'bad_output';

export class AssistantProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly reason: ProviderFailure,
    readonly retryAfterSeconds?: number,
  ) {
    super(`${provider}: ${reason}`);
    this.name = 'AssistantProviderError';
  }
}

/** Same shape as the bot's EntryCandidate, produced from untrusted model output. */
export interface AssistantEntry {
  type: 'INCOME' | 'EXPENSE';
  amount: bigint;
  note: string;
  date: string;
  categoryName: string | null;
  accountName: string | null;
}

export const MAX_ENTRIES_PER_MESSAGE = 5;
const MAX_DAYS_AGO = 366;
const MAX_NOTE_LENGTH = 200;

function toTiyin(amount: string): bigint | null {
  try {
    const tiyin = somToTiyin(amount.trim());
    return positiveTiyinSchema.safeParse(tiyin.toString()).success ? tiyin : null;
  } catch {
    return null;
  }
}

/** Drops anything that would not pass the regular transaction validation. */
export function toAssistantEntries(extraction: Extraction, today: string): AssistantEntry[] {
  const base = parseIsoDate(today);
  const entries: AssistantEntry[] = [];
  for (const raw of extraction.entries) {
    if (entries.length >= MAX_ENTRIES_PER_MESSAGE) break;
    const amount = toTiyin(raw.amount);
    if (amount === null || raw.daysAgo < 0 || raw.daysAgo > MAX_DAYS_AGO) continue;
    entries.push({
      type: raw.type,
      amount,
      note: raw.note.trim().slice(0, MAX_NOTE_LENGTH),
      date: formatIsoDate(addDays(base, -raw.daysAgo)),
      categoryName: raw.category.trim() || null,
      accountName: raw.account.trim() || null,
    });
  }
  return entries;
}

/** Parses a model's JSON answer; null when it is not valid JSON. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
}
