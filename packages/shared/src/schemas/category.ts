import { z } from 'zod';
import { colorSchema, emptyToNull, iconSchema } from './common';

export const CategoryTypeSchema = z.enum(['INCOME', 'EXPENSE']);
export type CategoryType = z.infer<typeof CategoryTypeSchema>;

export const CreateCategoryInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Kategoriya nomi kiritilishi shart')
      .max(50, 'Kategoriya nomi 50 belgidan oshmasligi kerak'),
    type: CategoryTypeSchema,
    icon: iconSchema.optional().default('💰'),
    color: colorSchema.optional().default('#6366f1'),
    parentId: emptyToNull(z.string().uuid('Yaroqsiz ota kategoriya ID')),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

export const UpdateCategoryInputSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    icon: iconSchema.optional(),
    color: colorSchema.optional(),
    parentId: emptyToNull(z.string().uuid('Yaroqsiz ota kategoriya ID')),
  })
  .strict();
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;

export const ReorderCategoriesInputSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().uuid('Yaroqsiz ID'),
            sortOrder: z.number().int().min(0).max(10_000),
          })
          .strict(),
      )
      .min(1, 'Kamida bitta kategoriya kiritilishi kerak')
      .max(200),
  })
  .strict();
export type ReorderCategoriesInput = z.infer<typeof ReorderCategoriesInputSchema>;

export const ListCategoriesQuerySchema = z.object({
  type: CategoryTypeSchema.optional(),
});
export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuerySchema>;

export interface CategoryResponse {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  parentId: string | null;
  isSystem: boolean;
  sortOrder: number;
  children?: CategoryResponse[];
  createdAt: string;
  updatedAt: string;
}

export const CategoryResponseSchema: z.ZodType<CategoryResponse> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: CategoryTypeSchema,
    icon: z.string(),
    color: z.string(),
    parentId: z.string().uuid().nullable(),
    isSystem: z.boolean(),
    sortOrder: z.number(),
    children: z.array(CategoryResponseSchema).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);
