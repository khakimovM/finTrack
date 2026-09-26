import { z } from 'zod';
import { isValidIsoDate } from '../date';
import { positiveTiyinSchema } from './common';

export const BudgetMonthSchema = z
  .string()
  .refine((val) => (/^\d{4}-\d{2}$/.test(val) ? isValidIsoDate(`${val}-01`) : isValidIsoDate(val)), {
    message: 'Oy YYYY-MM yoki YYYY-MM-DD formatida bo‘lishi kerak',
  });

export const BudgetStateSchema = z.enum(['OK', 'WARNING', 'EXCEEDED']);
export type BudgetState = z.infer<typeof BudgetStateSchema>;

export const CreateBudgetInputSchema = z
  .object({
    categoryId: z.string().uuid('Yaroqsiz kategoriya ID si'),
    month: BudgetMonthSchema,
    limitAmount: positiveTiyinSchema,
  })
  .strict();
export type CreateBudgetInput = z.infer<typeof CreateBudgetInputSchema>;

export const UpdateBudgetInputSchema = z
  .object({
    limitAmount: positiveTiyinSchema,
  })
  .strict();
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetInputSchema>;

export const ListBudgetsQuerySchema = z.object({
  month: BudgetMonthSchema.optional(),
});
export type ListBudgetsQuery = z.infer<typeof ListBudgetsQuerySchema>;

export const BudgetResponseSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  month: z.string(),
  limitAmount: z.string(),
  notifiedAt: z.number(),
  category: z.object({
    id: z.string().uuid(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BudgetResponse = z.infer<typeof BudgetResponseSchema>;

export const BudgetStatusItemSchema = z.object({
  id: z.string().uuid(),
  category: z.object({
    id: z.string().uuid(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  limitAmount: z.string(),
  spent: z.string(),
  remaining: z.string(),
  percent: z.number(),
  state: BudgetStateSchema,
});
export type BudgetStatusItem = z.infer<typeof BudgetStatusItemSchema>;

export const BudgetStatusResponseSchema = z.object({
  data: z.array(BudgetStatusItemSchema),
  meta: z.object({
    month: z.string(),
    totalLimit: z.string(),
    totalSpent: z.string(),
  }),
});
export type BudgetStatusResponse = z.infer<typeof BudgetStatusResponseSchema>;
