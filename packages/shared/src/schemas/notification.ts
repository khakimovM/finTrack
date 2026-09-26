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

export const ListNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;

export const NotificationResponseSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  meta: z.record(z.unknown()).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;

export const NotificationListResponseSchema = z.object({
  data: z.array(NotificationResponseSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    unreadCount: z.number(),
  }),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;
