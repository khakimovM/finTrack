import { z } from 'zod';
import { colorSchema, currencySchema, iconSchema, signedTiyinSchema } from './common';

export const AccountTypeSchema = z.enum(['CASH', 'CARD', 'BANK', 'SAVINGS']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const CreateAccountInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Hisob nomi kiritilishi shart')
      .max(50, 'Hisob nomi 50 belgidan oshmasligi kerak'),
    type: AccountTypeSchema,
    currency: currencySchema.optional().default('UZS'),
    openingBalance: signedTiyinSchema.optional().default('0'),
    icon: iconSchema.optional().default('💳'),
    color: colorSchema.optional().default('#6366f1'),
    isDefault: z.boolean().optional().default(false),
  })
  .strict();
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const UpdateAccountInputSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    type: AccountTypeSchema.optional(),
    currency: currencySchema.optional(),
    openingBalance: signedTiyinSchema.optional(),
    icon: iconSchema.optional(),
    color: colorSchema.optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

export const ReorderItemSchema = z
  .object({
    id: z.string().uuid('Yaroqsiz ID'),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .strict();

export const ReorderAccountsInputSchema = z
  .object({
    items: z.array(ReorderItemSchema).min(1, 'Kamida bitta hisob kiritilishi kerak').max(100),
  })
  .strict();
export type ReorderAccountsInput = z.infer<typeof ReorderAccountsInputSchema>;

export const ListAccountsQuerySchema = z.object({
  includeArchived: z.enum(['true', 'false']).optional(),
});
export type ListAccountsQuery = z.infer<typeof ListAccountsQuerySchema>;

export const AccountResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: AccountTypeSchema,
  currency: z.string(),
  openingBalance: z.string(),
  balance: z.string(),
  icon: z.string(),
  color: z.string(),
  isDefault: z.boolean(),
  sortOrder: z.number(),
  archivedAt: z.string().nullable(),
  transactionCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AccountResponse = z.infer<typeof AccountResponseSchema>;

export const AccountListMetaSchema = z.object({
  totalBalance: z.string(),
});
export type AccountListMeta = z.infer<typeof AccountListMetaSchema>;
