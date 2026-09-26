import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateBudgetInputSchema,
  UpdateBudgetInputSchema,
  BudgetMonthSchema,
} from '@fintrack/shared';

export class CreateBudgetDto extends createZodDto(CreateBudgetInputSchema) {}
export class UpdateBudgetDto extends createZodDto(UpdateBudgetInputSchema) {}

export const ListBudgetsQuerySchema = z.object({
  month: BudgetMonthSchema.optional(),
});
export class ListBudgetsQueryDto extends createZodDto(ListBudgetsQuerySchema) {}
