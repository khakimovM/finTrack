import { createZodDto } from 'nestjs-zod';
import {
  CreateRecurringRuleInputSchema,
  UpdateRecurringRuleInputSchema,
  ListRecurringRulesQuerySchema,
} from '@fintrack/shared';

export class CreateRecurringRuleDto extends createZodDto(CreateRecurringRuleInputSchema) {}
export class UpdateRecurringRuleDto extends createZodDto(UpdateRecurringRuleInputSchema) {}
export class ListRecurringRulesQueryDto extends createZodDto(ListRecurringRulesQuerySchema) {}
