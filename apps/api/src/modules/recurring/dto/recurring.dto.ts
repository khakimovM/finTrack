import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateRecurringRuleInputSchema,
  UpdateRecurringRuleInputSchema,
} from '@fintrack/shared';

export class CreateRecurringRuleDto extends createZodDto(CreateRecurringRuleInputSchema) {}
export class UpdateRecurringRuleDto extends createZodDto(UpdateRecurringRuleInputSchema) {}

export const ListRecurringRulesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});
export class ListRecurringRulesQueryDto extends createZodDto(ListRecurringRulesQuerySchema) {}
