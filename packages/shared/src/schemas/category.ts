import { z } from 'zod';

export const CategoryTypeSchema = z.enum(['INCOME', 'EXPENSE']);
export type CategoryType = z.infer<typeof CategoryTypeSchema>;

export const CreateCategoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Kategoriya nomi kiritilishi shart').max(50, 'Kategoriya nomi 50 belgidan oshmasligi kerak'),
  type: CategoryTypeSchema,
  icon: z.string().optional().default('💰'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Rang hex formatida bo‘lishi kerak (#rrggbb)').optional().default('#6366f1'),
  parentId: z.string().uuid('Yaroqsiz ota kategoriya ID').nullable().optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

export const UpdateCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  parentId: z.string().uuid('Yaroqsiz ota kategoriya ID').nullable().optional(),
});
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;

export const ReorderCategoriesInputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid('Yaroqsiz ID'),
      sortOrder: z.number().int().min(0),
    }),
  ).min(1, 'Kamida bitta kategoriya kiritilishi kerak'),
});
export type ReorderCategoriesInput = z.infer<typeof ReorderCategoriesInputSchema>;

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
