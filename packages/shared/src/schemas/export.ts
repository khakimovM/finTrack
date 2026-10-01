import { z } from 'zod';
import { refineDateRange } from './common';
import { TransactionFiltersSchema } from './transaction';

export const ExportTransactionsQuerySchema = TransactionFiltersSchema.superRefine((value, ctx) =>
  refineDateRange(value, ctx),
);
export type ExportTransactionsQuery = z.infer<typeof ExportTransactionsQuerySchema>;
