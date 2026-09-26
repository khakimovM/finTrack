import { z } from 'zod';

export const DebtDirectionSchema = z.enum(['I_LENT', 'I_BORROWED']);
export type DebtDirection = z.infer<typeof DebtDirectionSchema>;

export const DebtStatusSchema = z.enum(['ACTIVE', 'PARTIALLY_PAID', 'PAID']);
export type DebtStatus = z.infer<typeof DebtStatusSchema>;

export const CreateDebtInputSchema = z.object({
  direction: DebtDirectionSchema,
  personName: z.string().trim().min(1, 'Shaxs ismi kiritilishi shart').max(100, 'Ism 100 belgidan oshmasligi kerak'),
  personPhone: z.string().trim().max(30, 'Telefon raqami 30 belgidan oshmasligi kerak').optional().nullable(),
  accountId: z.string().uuid('Yaroqsiz hisob ID si'),
  amount: z.string().regex(/^[1-9]\d*$/, 'Summa 0 dan katta butun tiyin bo‘lishi kerak'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo‘lishi kerak').optional().nullable(),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
});
export type CreateDebtInput = z.infer<typeof CreateDebtInputSchema>;

export const UpdateDebtInputSchema = z.object({
  personName: z.string().trim().min(1).max(100).optional(),
  personPhone: z.string().trim().max(30).optional().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});
export type UpdateDebtInput = z.infer<typeof UpdateDebtInputSchema>;

export const CreateDebtPaymentInputSchema = z.object({
  amount: z.string().regex(/^[1-9]\d*$/, 'Summa 0 dan katta butun tiyin bo‘lishi kerak'),
  accountId: z.string().uuid('Yaroqsiz hisob ID si'),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo‘lishi kerak').optional(),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
});
export type CreateDebtPaymentInput = z.infer<typeof CreateDebtPaymentInputSchema>;

export const SettleDebtInputSchema = z.object({
  accountId: z.string().uuid('Yaroqsiz hisob ID si'),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo‘lishi kerak').optional(),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
});
export type SettleDebtInput = z.infer<typeof SettleDebtInputSchema>;

export const ListDebtsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: DebtDirectionSchema.optional(),
  status: DebtStatusSchema.optional(),
  overdue: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});
export type ListDebtsQuery = z.infer<typeof ListDebtsQuerySchema>;

export const DebtResponseSchema = z.object({
  id: z.string().uuid(),
  direction: DebtDirectionSchema,
  personName: z.string(),
  personPhone: z.string().nullable(),
  amount: z.string(),
  paidAmount: z.string(),
  remainingAmount: z.string(),
  dueDate: z.string().nullable(),
  status: DebtStatusSchema,
  paidAt: z.string().nullable(),
  isOverdue: z.boolean(),
  daysLeft: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DebtResponse = z.infer<typeof DebtResponseSchema>;

export const DebtPaymentResponseSchema = z.object({
  id: z.string().uuid(),
  amount: z.string(),
  paidAt: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type DebtPaymentResponse = z.infer<typeof DebtPaymentResponseSchema>;

export const DebtSummarySchema = z.object({
  owedToMe: z.string(),
  iOwe: z.string(),
  net: z.string(),
  overdueCount: z.number(),
});
export type DebtSummary = z.infer<typeof DebtSummarySchema>;

export const DebtListMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  summary: DebtSummarySchema,
});
export type DebtListMeta = z.infer<typeof DebtListMetaSchema>;
