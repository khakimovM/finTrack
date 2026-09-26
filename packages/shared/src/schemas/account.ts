import { z } from 'zod';

export const AccountTypeSchema = z.enum(['CASH', 'CARD', 'BANK', 'SAVINGS']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const CreateAccountInputSchema = z.object({
  name: z.string().trim().min(1, 'Hisob nomi kiritilishi shart').max(50, 'Hisob nomi 50 belgidan oshmasligi kerak'),
  type: AccountTypeSchema,
  currency: z.string().length(3, 'Valyuta kodi 3 ta harf bo‘lishi kerak').optional().default('UZS'),
  openingBalance: z
    .string()
    .regex(/^-?\d+$/, 'Boshlang‘ich balans tiyinda butun son bo‘lishi kerak')
    .optional()
    .default('0'),
  icon: z.string().optional().default('💳'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Rang hex formatida bo‘lishi kerak (#rrggbb)').optional().default('#6366f1'),
  isDefault: z.boolean().optional().default(false),
});
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const UpdateAccountInputSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  type: AccountTypeSchema.optional(),
  currency: z.string().length(3).optional(),
  openingBalance: z.string().regex(/^-?\d+$/).optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

export const ReorderItemSchema = z.object({
  id: z.string().uuid('Yaroqsiz ID'),
  sortOrder: z.number().int().min(0),
});

export const ReorderAccountsInputSchema = z.object({
  items: z.array(ReorderItemSchema).min(1, 'Kamida bitta hisob kiritilishi kerak'),
});
export type ReorderAccountsInput = z.infer<typeof ReorderAccountsInputSchema>;

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
