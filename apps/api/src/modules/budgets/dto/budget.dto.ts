import { createZodDto } from 'nestjs-zod';
import {
  CreateBudgetInputSchema,
  UpdateBudgetInputSchema,
  ListBudgetsQuerySchema,
} from '@fintrack/shared';

export class CreateBudgetDto extends createZodDto(CreateBudgetInputSchema) {}
export class UpdateBudgetDto extends createZodDto(UpdateBudgetInputSchema) {}
export class ListBudgetsQueryDto extends createZodDto(ListBudgetsQuerySchema) {}
