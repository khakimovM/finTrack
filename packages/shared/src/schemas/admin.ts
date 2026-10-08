import { z } from 'zod';
import { isoDateSchema, refineDateRange } from './common';

// ------------------------------------------------------------------
// Admin panel (owner only). Sign-in reuses the Telegram schemas in ./auth:
// start → TelegramLoginStartResponse, status → TelegramLoginStatusResponse,
// verify → VerifyTelegramLoginInput; only the deep link prefix (admin_) and the session differ.
// ------------------------------------------------------------------

export const AdminProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  telegramUsername: z.string().nullable(),
});
export type AdminProfile = z.infer<typeof AdminProfileSchema>;

/** `POST /admin/auth/telegram/verify` and `GET /admin/auth/me`. */
export const AdminSessionResponseSchema = z.object({
  admin: AdminProfileSchema,
  /** ISO time the session ends at the latest (8 h after sign-in); idle sessions end sooner. */
  expiresAt: z.string(),
});
export type AdminSessionResponse = z.infer<typeof AdminSessionResponseSchema>;

// ------------------------------------------------------------------
// Statistics. Counts and dates only: no amounts, balances or free text ever leave these
// endpoints (decided with the owner, docs/09). Days are Asia/Tashkent calendar days.
// "Entries" are ledger rows a person made or a rule booked: opening balances are left out and a
// transfer counts once.
// ------------------------------------------------------------------

const count = z.number().int().nonnegative();

/** A count over the latest window and over the window of the same length before it. */
export const AdminCountChangeSchema = z.object({ current: count, previous: count });
export type AdminCountChange = z.infer<typeof AdminCountChangeSchema>;

export const AdminOverviewResponseSchema = z.object({
  /** The day "today" refers to. */
  today: z.string(),
  users: z.object({
    /** Registered and not deleted. */
    total: count,
    newToday: count,
    new7d: AdminCountChangeSchema,
    new30d: AdminCountChangeSchema,
    activeToday: count,
    active7d: AdminCountChangeSchema,
    active30d: AdminCountChangeSchema,
    /** Blocked the bot (Telegram answers 403). */
    botBlocked: count,
    banned: count,
    deleted: count,
  }),
  entries: z.object({
    /** Live entries (not deleted). */
    total: count,
    today: count,
    last7d: AdminCountChangeSchema,
  }),
});
export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;

export const AdminStatsGroupBySchema = z.enum(['day', 'week', 'month']);
export type AdminStatsGroupBy = z.infer<typeof AdminStatsGroupBySchema>;

/** Bounded so a zero-filled series stays small. */
export const ADMIN_STATS_MAX_RANGE_DAYS = { day: 400, week: 3 * 366, month: 10 * 366 } as const;

export const AdminGrowthQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    groupBy: AdminStatsGroupBySchema.optional().default('day'),
  })
  .superRefine((v, ctx) => refineDateRange(v, ctx, ADMIN_STATS_MAX_RANGE_DAYS[v.groupBy]));
export type AdminGrowthQuery = z.infer<typeof AdminGrowthQuerySchema>;

export const AdminGrowthPointSchema = z.object({
  /** First day of the bucket (a Monday for weeks). Buckets are clipped to the range. */
  bucket: z.string(),
  newUsers: count,
  /** Everyone registered up to the end of the bucket, deleted accounts included. */
  registeredUsers: count,
  activeUsers: count,
  entries: count,
});
export type AdminGrowthPoint = z.infer<typeof AdminGrowthPointSchema>;

export const AdminGrowthResponseSchema = z.object({
  groupBy: AdminStatsGroupBySchema,
  points: z.array(AdminGrowthPointSchema),
});
export type AdminGrowthResponse = z.infer<typeof AdminGrowthResponseSchema>;

export const ADMIN_RETENTION_WEEKS = 9;

export const AdminRetentionQuerySchema = z.object({
  /** How many weekly sign-up cohorts, newest last. */
  cohorts: z.coerce.number().int().min(1).max(26).optional().default(12),
});
export type AdminRetentionQuery = z.infer<typeof AdminRetentionQuerySchema>;

export const AdminRetentionResponseSchema = z.object({
  /** Columns: week 0 (the sign-up week) to week 8. */
  weeks: z.number().int(),
  cohorts: z.array(
    z.object({
      /** Monday of the sign-up week. */
      week: z.string(),
      size: count,
      /** Users of the cohort active in week n; null for weeks that have not started. */
      active: z.array(count.nullable()),
    }),
  ),
});
export type AdminRetentionResponse = z.infer<typeof AdminRetentionResponseSchema>;

/** Usage and funnel cover a period: the last 30 days unless given. */
export const AdminPeriodQuerySchema = z
  .object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() })
  .superRefine((v, ctx) => refineDateRange(v, ctx, 400));
export type AdminPeriodQuery = z.infer<typeof AdminPeriodQuerySchema>;

const assistantOutcomes = z.object({ ok: count, limit: count, unavailable: count });

export const AdminUsageResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  /** Distinct users active in the period, overall and per channel (one user can use several). */
  activeUsers: z.object({ total: count, web: count, miniApp: count, bot: count, unknown: count }),
  /** Entries made in the period by where they were made; unknown = before sources were recorded. */
  entries: z.object({
    total: count,
    web: count,
    miniApp: count,
    bot: count,
    voice: count,
    recurring: count,
    unknown: count,
  }),
  /** Current users (not deleted) using each feature now. */
  features: z.object({
    users: count,
    withDebt: count,
    withBudget: count,
    withRecurring: count,
    withTag: count,
    withSeveralAccounts: count,
    withOwnCategory: count,
    strictMode: count,
    dailyDigest: count,
    telegramNotifications: count,
  }),
  assistant: z.object({
    voice: assistantOutcomes,
    text: assistantOutcomes,
    providers: z.array(z.object({ name: z.string(), ok: count, failed: count, failures: z.record(count) })),
  }),
});
export type AdminUsageResponse = z.infer<typeof AdminUsageResponseSchema>;

/** People who signed up in the period, and how far each got. */
export const AdminFunnelResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  registered: count,
  firstEntry: count,
  fiveEntries: count,
  /** Came back in their second week (days 7–13 after sign-up). */
  returnedWeek2: count,
});
export type AdminFunnelResponse = z.infer<typeof AdminFunnelResponseSchema>;
