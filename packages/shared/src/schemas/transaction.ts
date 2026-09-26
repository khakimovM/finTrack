import { z } from 'zod';

export const TransactionTypeSchema = z.enum([
  'INCOME',
  'EXPENSE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'LOAN_GIVEN',
  'LOAN_TAKEN',
  'LOAN_REPAY_IN',
  'LOAN_REPAY_OUT',
  'ADJUSTMENT',
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const CreateTransactionInputSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE'], {
    errorMap: () => ({ message: 'Faqat daromad yoki xarajat turini kiritish mumkin' }),
  }),
  accountId: z.string().uuid('Yaroqsiz hisob ID si'),
  amount: z.string().regex(/^[1-9]\d*$/, 'Summa 0 dan katta butun tiyin bo‘lishi kerak'),
  categoryId: z.string().uuid('Yaroqsiz kategoriya ID si'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo‘lishi kerak'),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
  tagIds: z.array(z.string().uuid('Yaroqsiz teg ID si')).optional(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;

export const UpdateTransactionInputSchema = z.object({
  accountId: z.string().uuid('Yaroqsiz hisob ID si').optional(),
  amount: z.string().regex(/^[1-9]\d*$/, 'Summa 0 dan katta butun tiyin bo‘lishi kerak').optional(),
  categoryId: z.string().uuid('Yaroqsiz kategoriya ID si').optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo‘lishi kerak').optional(),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
  tagIds: z.array(z.string().uuid('Yaroqsiz teg ID si')).optional(),
});
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInputSchema>;

export const ListTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: TransactionTypeSchema.optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  minAmount: z.string().regex(/^\d+$/).optional(),
  maxAmount: z.string().regex(/^\d+$/).optional(),
  search: z.string().optional(),
  sort: z
    .enum([
      'date:desc',
      'date:asc',
      'amount:desc',
      'amount:asc',
      'createdAt:desc',
      'createdAt:asc',
    ])
    .default('date:desc'),
});
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;

export const BulkDeleteTransactionsInputSchema = z.object({
  ids: z.array(z.string().uuid('Yaroqsiz tranzaksiya ID si')).min(1, 'Kamida bitta tranzaksiya tanlanishi kerak'),
});
export type BulkDeleteTransactionsInput = z.infer<typeof BulkDeleteTransactionsInputSchema>;

export const TransactionResponseSchema = z.object({
  id: z.string().uuid(),
  type: TransactionTypeSchema,
  amount: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  account: z.object({
    id: z.string().uuid(),
    name: z.string(),
    icon: z.string(),
  }),
  category: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      icon: z.string(),
      color: z.string(),
    })
    .nullable(),
  tags: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string(),
    }),
  ),
  debtId: z.string().uuid().nullable(),
  transferGroupId: z.string().nullable(),
  createdAt: z.string(),
});
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;

export const TransactionListMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  sums: z.object({
    income: z.string(),
    expense: z.string(),
  }),
});
export type TransactionListMeta = z.infer<typeof TransactionListMetaSchema>;
