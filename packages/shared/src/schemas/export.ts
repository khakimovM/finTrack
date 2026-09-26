import { z } from 'zod';
import { TransactionTypeSchema } from './transaction';

export const ExportTransactionsQuerySchema = z.object({
  type: TransactionTypeSchema.optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatida bo‘lishi kerak').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatida bo‘lishi kerak').optional(),
  search: z.string().optional(),
});
export type ExportTransactionsQuery = z.infer<typeof ExportTransactionsQuerySchema>;
