import type { DefaultJobOptions } from 'bullmq';

/** One queue per concern: a queue has exactly one processor class consuming it. */
export const QUEUES = {
  RECURRING: 'recurring',
  DEBT_REMINDERS: 'debt-reminders',
  TELEGRAM_OUTBOX: 'telegram-outbox',
  DAILY_DIGEST: 'daily-digest',
  BROADCAST: 'broadcast',
} as const;

export const JOBS = {
  PROCESS_DUE_RULES: 'process-due-rules',
  SEND_DEBT_REMINDERS: 'send-debt-reminders',
  DELIVER_NOTIFICATION: 'deliver-notification',
  SEND_DAILY_DIGEST: 'send-daily-digest',
  DELIVER_BROADCAST: 'deliver-broadcast',
} as const;

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 1000 },
};

/** Telegram answers 429 under bursts; back off and retry instead of dropping the alert. */
export const OUTBOX_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 6,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
