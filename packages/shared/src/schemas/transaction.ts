import { z } from 'zod';
import {
  isoDateSchema,
  nonNegativeTiyinSchema,
  noteSchema,
  positiveTiyinSchema,
  refineDateRange,
  searchSchema,
} from './common';

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

/**
 * Only these types may be edited or deleted through /transactions. Transfer and loan rows are
 * owned by /transfers and /debts, which keep the paired rows and debt payments consistent.
 */
export const USER_MANAGED_TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;

export function isUserManagedTransactionType(type: string): boolean {
  return (USER_MANAGED_TRANSACTION_TYPES as readonly string[]).includes(type);
}

const tagIdsSchema = z.array(z.string().uuid('Yaroqsiz teg ID si')).max(20, 'Ko‘pi bilan 20 ta teg');

export const CreateTransactionInputSchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE'], {
      errorMap: () => ({ message: 'Faqat daromad yoki xarajat turini kiritish mumkin' }),
    }),
    accountId: z.string().uuid('Yaroqsiz hisob ID si'),
    amount: positiveTiyinSchema,
    categoryId: z.string().uuid('Yaroqsiz kategoriya ID si'),
    date: isoDateSchema,
    note: noteSchema.optional().nullable(),
    tagIds: tagIdsSchema.optional(),
  })
  .strict();
export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;

export const UpdateTransactionInputSchema = z
  .object({
    /** Switch between income and expense; the category must be of the new type. */
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    accountId: z.string().uuid('Yaroqsiz hisob ID si').optional(),
    amount: positiveTiyinSchema.optional(),
    categoryId: z.string().uuid('Yaroqsiz kategoriya ID si').optional().nullable(),
    date: isoDateSchema.optional(),
    note: noteSchema.optional().nullable(),
    tagIds: tagIdsSchema.optional(),
  })
  .strict();
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInputSchema>;

export const TransactionFiltersSchema = z.object({
  type: TransactionTypeSchema.optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  minAmount: nonNegativeTiyinSchema.optional(),
  maxAmount: nonNegativeTiyinSchema.optional(),
  search: searchSchema.optional(),
});
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;

export const ListTransactionsQuerySchema = TransactionFiltersSchema.extend({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['date:desc', 'date:asc', 'amount:desc', 'amount:asc', 'createdAt:desc', 'createdAt:asc'])
    .default('date:desc'),
}).superRefine((value, ctx) => refineDateRange(value, ctx));
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;

export const BulkDeleteTransactionsInputSchema = z
  .object({
    ids: z
      .array(z.string().uuid('Yaroqsiz tranzaksiya ID si'))
      .min(1, 'Kamida bitta tranzaksiya tanlanishi kerak')
      .max(100, 'Bir martada ko‘pi bilan 100 ta tranzaksiya'),
  })
  .strict();
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
  /** The debt a loan row belongs to, so lists can name the person. */
  debt: z.object({ id: z.string().uuid(), personName: z.string() }).nullable(),
  transferGroupId: z.string().nullable(),
  /** The other leg of a transfer: "Humo karta → Jamg‘arma". */
  transferPeer: z.object({ accountId: z.string().uuid(), name: z.string(), icon: z.string() }).nullable(),
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
    /** How many income and expense rows the whole filter matches. */
    incomeCount: z.number(),
    expenseCount: z.number(),
  }),
});
export type TransactionListMeta = z.infer<typeof TransactionListMetaSchema>;
