import { createZodDto } from 'nestjs-zod';
import {
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
  ReorderCategoriesInputSchema,
} from '@fintrack/shared';

export class CreateCategoryDto extends createZodDto(CreateCategoryInputSchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategoryInputSchema) {}
export class ReorderCategoriesDto extends createZodDto(ReorderCategoriesInputSchema) {}
