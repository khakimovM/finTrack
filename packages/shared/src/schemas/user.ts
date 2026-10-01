import { z } from 'zod';
import { LocaleSchema } from './auth';

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Ism kamida 2 ta belgidan iborat bo‘lishi kerak').max(100).optional(),
    locale: LocaleSchema.optional(),
    timezone: z
      .string()
      .max(64)
      .refine(isValidTimeZone, { message: 'Nomaʼlum vaqt zonasi' })
      .optional(),
    strictMode: z.boolean().optional(),
    notifyTelegram: z.boolean().optional(),
    dailyDigest: z.boolean().optional(),
  })
  .strict();
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

/** The user types this phrase to confirm; it cannot be sent by a stray click. */
export const DELETE_ACCOUNT_CONFIRMATION = 'O‘CHIRISH';

export const DeleteAccountSchema = z
  .object({
    confirm: z.literal(DELETE_ACCOUNT_CONFIRMATION, {
      errorMap: () => ({ message: `Tasdiqlash uchun "${DELETE_ACCOUNT_CONFIRMATION}" deb yozing` }),
    }),
  })
  .strict();
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;

export const TelegramLinkResponseSchema = z.object({
  requestId: z.string().uuid(),
  deepLink: z.string().url(),
  expiresAt: z.string(),
});
export type TelegramLinkResponse = z.infer<typeof TelegramLinkResponseSchema>;
