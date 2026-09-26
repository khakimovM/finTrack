import { z } from 'zod';
import { emptyToNull, isoDateSchema, noteSchema, positiveTiyinSchema } from './common';

export const RecurrenceFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
export type RecurrenceFrequency = z.infer<typeof RecurrenceFrequencySchema>;

const dayOfCycleSchema = z.number().int().min(1).max(31);

function refineRule(
  value: { frequency?: RecurrenceFrequency; dayOfCycle?: number | null; startsAt?: string; endsAt?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.frequency === 'WEEKLY' && value.dayOfCycle != null && value.dayOfCycle > 7) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dayOfCycle'],
      message: 'Haftalik qoida uchun kun 1 (dushanba) dan 7 (yakshanba) gacha bo‘lishi kerak',
    });
  }
  if (value.startsAt && value.endsAt && value.endsAt < value.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas',
    });
  }
}

export const CreateRecurringRuleInputSchema = z
  .object({
    accountId: z.string().uuid('Yaroqsiz hisob ID si'),
    categoryId: emptyToNull(z.string().uuid('Yaroqsiz kategoriya ID si')),
    type: z.enum(['INCOME', 'EXPENSE']),
    amount: positiveTiyinSchema,
    frequency: RecurrenceFrequencySchema,
    dayOfCycle: dayOfCycleSchema.optional().nullable(),
    startsAt: isoDateSchema,
    endsAt: emptyToNull(isoDateSchema),
    note: noteSchema.optional().nullable(),
  })
  .strict()
  .superRefine(refineRule);
export type CreateRecurringRuleInput = z.infer<typeof CreateRecurringRuleInputSchema>;

export const UpdateRecurringRuleInputSchema = z
  .object({
    amount: positiveTiyinSchema.optional(),
    note: noteSchema.optional().nullable(),
    isActive: z.boolean().optional(),
    dayOfCycle: dayOfCycleSchema.optional().nullable(),
    endsAt: emptyToNull(isoDateSchema),
  })
  .strict();
export type UpdateRecurringRuleInput = z.infer<typeof UpdateRecurringRuleInputSchema>;

export const ListRecurringRulesQuerySchema = z.object({
  isActive: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});
export type ListRecurringRulesQuery = z.infer<typeof ListRecurringRulesQuerySchema>;

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
