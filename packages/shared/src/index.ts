import { z } from 'zod';

export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().optional(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export * from './money';
export * from './date';
export * from './recurrence';
export * from './schemas/auth';
export * from './schemas/user';
export * from './schemas/account';
export * from './schemas/category';
export * from './schemas/tag';
export * from './schemas/transaction';
export * from './schemas/transfer';
export * from './schemas/debt';
export * from './schemas/stats';
export * from './schemas/budget';
export * from './schemas/notification';
export * from './schemas/recurring';
export * from './schemas/export';
export * from './schemas/common';
