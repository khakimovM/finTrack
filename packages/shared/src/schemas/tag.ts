import { z } from 'zod';

export const CreateTagInputSchema = z.object({
  name: z.string().trim().min(1, 'Teg nomi kiritilishi shart').max(30, 'Teg nomi 30 belgidan oshmasligi kerak'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Rang hex formatida bo‘lishi kerak (#rrggbb)').default('#94a3b8'),
});
export type CreateTagInput = z.infer<typeof CreateTagInputSchema>;

export const UpdateTagInputSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type UpdateTagInput = z.infer<typeof UpdateTagInputSchema>;

export const TagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  transactionCount: z.number(),
  createdAt: z.string(),
});
export type TagResponse = z.infer<typeof TagResponseSchema>;
