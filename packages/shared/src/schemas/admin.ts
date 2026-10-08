import { z } from 'zod';

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
