import { z } from 'zod';

// ------------------------------------------------------------------
// Admin panel: people, the system and the audit log (docs/09, J4). A person is shown by name,
// @username and activity; amounts, balances and notes never leave the API, and a phone number
// only as its last two digits.
// ------------------------------------------------------------------

const count = z.number().int().nonnegative();

const pageMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export const AdminChannelSchema = z.enum(['WEB', 'MINIAPP', 'BOT', 'UNKNOWN']);
export type AdminChannel = z.infer<typeof AdminChannelSchema>;

export const AdminUserStatusSchema = z.enum(['active', 'banned', 'deleted']);
export type AdminUserStatus = z.infer<typeof AdminUserStatusSchema>;

/** `active` = neither banned nor deleted; `botBlocked` = the person blocked the bot. */
export const AdminUserFilterSchema = z.enum(['all', 'active', 'banned', 'deleted', 'botBlocked']);
export type AdminUserFilter = z.infer<typeof AdminUserFilterSchema>;

export const AdminUserSortSchema = z.enum(['newest', 'oldest', 'lastSeen', 'entries', 'name']);
export type AdminUserSort = z.infer<typeof AdminUserSortSchema>;

export const AdminUsersExportQuerySchema = z.object({
  /** Part of the name or @username, or a whole Telegram ID. */
  q: z.string().trim().max(100).optional(),
  status: AdminUserFilterSchema.optional().default('all'),
  sort: AdminUserSortSchema.optional().default('newest'),
});
export type AdminUsersExportQuery = z.infer<typeof AdminUsersExportQuerySchema>;

export const AdminUsersQuerySchema = AdminUsersExportQuerySchema.extend({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;

export const AdminUserRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  telegramUsername: z.string().nullable(),
  /** "+998 •• ••• •• 12": only the last two digits are real. */
  phone: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
  /** Live entries (see the statistics: opening balances left out, a transfer counted once). */
  entries: count,
  accounts: count,
  /** Channels used in the last 30 days. */
  channels: z.array(AdminChannelSchema),
  status: AdminUserStatusSchema,
  botBlocked: z.boolean(),
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;

export const AdminUsersResponseSchema = z.object({
  data: z.array(AdminUserRowSchema),
  meta: pageMeta,
});
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;

export const AdminUserDetailSchema = z.object({
  user: AdminUserRowSchema.extend({
    bannedAt: z.string().nullable(),
    banReason: z.string().nullable(),
    deletedAt: z.string().nullable(),
    /** On the admin list: cannot be banned. */
    isAdmin: z.boolean(),
  }),
  counts: z.object({
    entries: count,
    accounts: count,
    categories: count,
    debts: count,
    budgets: count,
    recurring: count,
    tags: count,
    activeSessions: count,
  }),
  entriesBySource: z.object({
    web: count,
    miniApp: count,
    bot: count,
    voice: count,
    recurring: count,
    unknown: count,
  }),
  /** Days of the last 90 with any activity, oldest first. */
  activity: z.array(z.object({ day: z.string(), channels: z.array(AdminChannelSchema) })),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const AdminBanUserSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();
export type AdminBanUserInput = z.infer<typeof AdminBanUserSchema>;

export const AdminRevokeSessionsResponseSchema = z.object({ revoked: count });
export type AdminRevokeSessionsResponse = z.infer<typeof AdminRevokeSessionsResponseSchema>;

// ------------------------------------------------------------------
// System
// ------------------------------------------------------------------

const dependency = z.object({
  status: z.enum(['ok', 'down']),
  latencyMs: z.number().int().nullable(),
});

export const AdminQueueSchema = z.object({
  name: z.string(),
  /** Null when the queue could not be read (Redis down). */
  counts: z
    .object({ waiting: count, active: count, delayed: count, failed: count, completed: count, paused: z.boolean() })
    .nullable(),
  recentFailures: z.array(
    z.object({
      job: z.string(),
      failedAt: z.string().nullable(),
      attempts: count,
      /** The error message, cut to 200 characters. */
      reason: z.string(),
    }),
  ),
});
export type AdminQueue = z.infer<typeof AdminQueueSchema>;

export const AdminSystemResponseSchema = z.object({
  version: z.object({
    /** Short git commit of the running build (Railway), null locally. */
    commit: z.string().nullable(),
    node: z.string(),
    environment: z.string(),
    startedAt: z.string(),
    uptimeSeconds: count,
  }),
  database: dependency.extend({ sizeBytes: z.number().int().nullable(), lastMigration: z.string().nullable() }),
  redis: dependency.extend({ usedMemoryBytes: z.number().int().nullable() }),
  queues: z.array(AdminQueueSchema),
  telegram: z.object({
    mode: z.enum(['webhook', 'polling', 'off']),
    /** Host of the registered webhook, never the full URL. */
    webhookHost: z.string().nullable(),
    pendingUpdates: count.nullable(),
    lastErrorAt: z.string().nullable(),
    lastError: z.string().nullable(),
  }),
});
export type AdminSystemResponse = z.infer<typeof AdminSystemResponseSchema>;

// ------------------------------------------------------------------
// Audit log
// ------------------------------------------------------------------

export const AdminAuditActionSchema = z.enum([
  'LOGIN',
  'LOGIN_DENIED',
  'LOGOUT',
  'BAN',
  'UNBAN',
  'REVOKE_SESSIONS',
  'BROADCAST',
  'EXPORT',
]);
export type AdminAuditActionName = z.infer<typeof AdminAuditActionSchema>;

export const AdminAuditQuerySchema = z.object({
  action: AdminAuditActionSchema.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminAuditQuery = z.infer<typeof AdminAuditQuerySchema>;

const personRef = z.object({ id: z.string(), name: z.string() }).nullable();

export const AdminAuditLogEntrySchema = z.object({
  id: z.string(),
  action: AdminAuditActionSchema,
  createdAt: z.string(),
  admin: personRef,
  /** The person acted on; the name is null once the account is gone. */
  target: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  /** Telegram ID of a refused sign-in. */
  telegramId: z.string().nullable(),
  meta: z.record(z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
});
export type AdminAuditLogEntry = z.infer<typeof AdminAuditLogEntrySchema>;

export const AdminAuditResponseSchema = z.object({
  data: z.array(AdminAuditLogEntrySchema),
  meta: pageMeta,
});
export type AdminAuditResponse = z.infer<typeof AdminAuditResponseSchema>;
