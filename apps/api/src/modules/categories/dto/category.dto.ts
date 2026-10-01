import { createZodDto } from 'nestjs-zod';
import {
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
  ReorderCategoriesInputSchema,
  ListCategoriesQuerySchema,
} from '@fintrack/shared';

export class CreateCategoryDto extends createZodDto(CreateCategoryInputSchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategoryInputSchema) {}
export class ReorderCategoriesDto extends createZodDto(ReorderCategoriesInputSchema) {}
export class ListCategoriesQueryDto extends createZodDto(ListCategoriesQuerySchema) {}
