import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const RecurrenceFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
export type RecurrenceFrequency = z.infer<typeof RecurrenceFrequencySchema>;

export const CreateRecurringRuleInputSchema = z.object({
  accountId: z.string().uuid('Yaroqsiz hisob ID si'),
  categoryId: z.string().uuid('Yaroqsiz kategoriya ID si').optional().nullable(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.string().regex(/^[1-9]\d*$/, 'Summa 0 dan katta butun tiyin bo‘lishi kerak'),
  frequency: RecurrenceFrequencySchema,
  dayOfCycle: z.number().int().min(1).max(31).optional().nullable(),
  startsAt: z.string().regex(ISO_DATE_REGEX, 'Boshlanish sanasi YYYY-MM-DD formatida bo‘lishi kerak'),
  endsAt: z.string().regex(ISO_DATE_REGEX, 'Tugash sanasi YYYY-MM-DD formatida bo‘lishi kerak').optional().nullable(),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
});
export type CreateRecurringRuleInput = z.infer<typeof CreateRecurringRuleInputSchema>;

export const UpdateRecurringRuleInputSchema = z.object({
  amount: z.string().regex(/^[1-9]\d*$/, 'Summa 0 dan katta butun tiyin bo‘lishi kerak').optional(),
  note: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  dayOfCycle: z.number().int().min(1).max(31).optional().nullable(),
  endsAt: z.string().regex(ISO_DATE_REGEX).optional().nullable(),
});
export type UpdateRecurringRuleInput = z.infer<typeof UpdateRecurringRuleInputSchema>;

export const RecurringRuleResponseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.string(),
  frequency: RecurrenceFrequencySchema,
  dayOfCycle: z.number().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  nextRunAt: z.string(),
  isActive: z.boolean(),
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
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RecurringRuleResponse = z.infer<typeof RecurringRuleResponseSchema>;
