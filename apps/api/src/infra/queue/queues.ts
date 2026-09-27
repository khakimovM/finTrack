import type { DefaultJobOptions } from 'bullmq';

/** One queue per concern: a queue has exactly one processor class consuming it. */
export const QUEUES = {
  RECURRING: 'recurring',
  DEBT_REMINDERS: 'debt-reminders',
} as const;

export const JOBS = {
  PROCESS_DUE_RULES: 'process-due-rules',
  SEND_DEBT_REMINDERS: 'send-debt-reminders',
} as const;

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 1000 },
};
