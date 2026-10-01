import { z } from 'zod';

// ------------------------------------------------------------------
// Telegram sign-in (web → bot deep link → one-time code → web)
// ------------------------------------------------------------------

export const TelegramLoginStatusSchema = z.enum([
  'PENDING',
  'AWAITING_CONTACT',
  'CODE_SENT',
  'CONSUMED',
  'CANCELLED',
  'EXPIRED',
]);
export type TelegramLoginStatus = z.infer<typeof TelegramLoginStatusSchema>;

export const TelegramLoginStartResponseSchema = z.object({
  requestId: z.string().uuid(),
  /** https://t.me/<bot>?start=login_<nonce> — opens the bot with the request attached. */
  deepLink: z.string().url(),
  botUsername: z.string(),
  expiresAt: z.string(),
});
export type TelegramLoginStartResponse = z.infer<typeof TelegramLoginStartResponseSchema>;

export const TelegramLoginStatusResponseSchema = z.object({
  status: TelegramLoginStatusSchema,
  expiresAt: z.string(),
  codeExpiresAt: z.string().nullable(),
  attemptsLeft: z.number(),
});
export type TelegramLoginStatusResponse = z.infer<typeof TelegramLoginStatusResponseSchema>;

export const VerifyTelegramLoginSchema = z
  .object({
    requestId: z.string().uuid('Yaroqsiz so‘rov'),
    code: z.string().trim().regex(/^\d{6}$/, 'Kod 6 ta raqamdan iborat bo‘lishi kerak'),
  })
  .strict();
export type VerifyTelegramLoginInput = z.infer<typeof VerifyTelegramLoginSchema>;

export const TelegramRequestRefSchema = z
  .object({
    requestId: z.string().uuid('Yaroqsiz so‘rov'),
  })
  .strict();
export type TelegramRequestRef = z.infer<typeof TelegramRequestRefSchema>;

// ------------------------------------------------------------------
// Current user & sessions
// ------------------------------------------------------------------

export const LocaleSchema = z.enum(['uz', 'ru', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  telegramLinked: z.boolean(),
  /** Masked, e.g. +99890***4567 — the full number never leaves the server. */
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
  baseCurrency: z.string(),
  locale: z.string(),
  timezone: z.string(),
  strictMode: z.boolean(),
  notifyTelegram: z.boolean(),
  dailyDigest: z.boolean(),
  createdAt: z.string(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const SessionResponseSchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

// ------------------------------------------------------------------
// Telegram Mini App
// ------------------------------------------------------------------

/** `Telegram.WebApp.initData` exactly as Telegram passed it (a signed query string). */
export const TelegramWebAppAuthSchema = z
  .object({
    initData: z.string().min(1, 'initData bo‘sh').max(4096, 'initData juda uzun'),
  })
  .strict();
export type TelegramWebAppAuthInput = z.infer<typeof TelegramWebAppAuthSchema>;

/**
 * Mini Apps run in Telegram's webview (an iframe on Telegram Web) where cookies are unreliable:
 * the access token is returned in the body and kept in memory. When it expires the app
 * exchanges the same initData again; there is no refresh token.
 */
export const TelegramWebAppAuthResponseSchema = z.object({
  user: UserResponseSchema,
  accessToken: z.string(),
  accessTokenExpiresIn: z.number().int(),
});
export type TelegramWebAppAuthResponse = z.infer<typeof TelegramWebAppAuthResponseSchema>;
