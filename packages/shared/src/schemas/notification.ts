import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'BUDGET_WARNING',
  'BUDGET_EXCEEDED',
  'DEBT_DUE_SOON',
  'DEBT_OVERDUE',
  'NEGATIVE_BALANCE',
  'RECURRING_CREATED',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationResponseSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  meta: z.record(z.any()).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;

export const NotificationListResponseSchema = z.object({
  data: z.array(NotificationResponseSchema),
  meta: z.object({
    unreadCount: z.number(),
    total: z.number(),
  }),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;
