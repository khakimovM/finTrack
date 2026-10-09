import { z } from 'zod';

// ------------------------------------------------------------------
// Admin panel: a message from the owner to many people through the bot (docs/09, J6).
// The owner sends it to themselves first; the real one needs the exact recipient count the
// confirmation showed, and every person gets it at most once.
// ------------------------------------------------------------------

const count = z.number().int().nonnegative();

export const BroadcastSegmentSchema = z.enum(['ALL', 'ACTIVE_30D', 'INACTIVE_30D']);
export type BroadcastSegment = z.infer<typeof BroadcastSegmentSchema>;

export const BroadcastStatusSchema = z.enum(['QUEUED', 'SENDING', 'DONE']);
export type BroadcastStatus = z.infer<typeof BroadcastStatusSchema>;

/** Plain text (no formatting), within Telegram's 4096-character message limit. */
export const BROADCAST_TEXT_MAX = 3500;
const text = z.string().trim().min(1).max(BROADCAST_TEXT_MAX);

export const BroadcastAudienceSchema = z
  .object({
    segment: BroadcastSegmentSchema,
    /** Also people who switched Telegram notifications off. */
    includeOptedOut: z.boolean().default(false),
  })
  .strict();
export type BroadcastAudience = z.infer<typeof BroadcastAudienceSchema>;

export const BroadcastPreviewResponseSchema = z.object({
  recipients: count,
  /** In the segment but left out: blocked the bot, or notifications off (when not included). */
  excluded: z.object({ botBlocked: count, optedOut: count }),
});
export type BroadcastPreviewResponse = z.infer<typeof BroadcastPreviewResponseSchema>;

export const BroadcastTestSchema = z.object({ text }).strict();
export type BroadcastTestInput = z.infer<typeof BroadcastTestSchema>;

export const CreateBroadcastSchema = BroadcastAudienceSchema.extend({
  text,
  /** The count the confirmation showed; a different count now answers 409 RECIPIENTS_CHANGED. */
  expectedRecipients: z.number().int().positive(),
}).strict();
export type CreateBroadcastInput = z.infer<typeof CreateBroadcastSchema>;

export const BroadcastResponseSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  segment: BroadcastSegmentSchema,
  includeOptedOut: z.boolean(),
  status: BroadcastStatusSchema,
  total: count,
  sent: count,
  /** Telegram answered 403: the person blocked the bot (and is marked so). */
  blocked: count,
  failed: count,
  /** Not handled yet. */
  pending: count,
  admin: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type BroadcastResponse = z.infer<typeof BroadcastResponseSchema>;

export const BroadcastListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type BroadcastListQuery = z.infer<typeof BroadcastListQuerySchema>;

export const BroadcastListResponseSchema = z.object({
  data: z.array(BroadcastResponseSchema),
  meta: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
});
export type BroadcastListResponse = z.infer<typeof BroadcastListResponseSchema>;
