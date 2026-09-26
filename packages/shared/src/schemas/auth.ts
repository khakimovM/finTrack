import { z } from 'zod';

export const RegisterSchema = z
  .object({
    name: z.string().trim().min(2, 'Ism kamida 2 ta belgidan iborat bo‘lishi kerak').max(100),
    email: z.string().trim().email('Yaroqli email kiriting').toLowerCase(),
    password: z.string().min(8, 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak').max(100),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z
  .object({
    email: z.string().trim().email('Yaroqli email kiriting').toLowerCase(),
    password: z.string().min(1, 'Parol kiritilishi shart'),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z
  .object({
    email: z.string().trim().email('Yaroqli email kiriting').toLowerCase(),
  })
  .strict();

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token kiritilishi shart'),
    password: z.string().min(8, 'Yangi parol kamida 8 ta belgidan iborat bo‘lishi kerak').max(100),
  })
  .strict();

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const VerifyEmailSchema = z
  .object({
    token: z.string().min(1, 'Token kiritilishi shart'),
  })
  .strict();

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  baseCurrency: z.string(),
  locale: z.string(),
  strictMode: z.boolean(),
  avatarUrl: z.string().nullable().optional(),
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
  expiresAt: z.string(),
  isCurrent: z.boolean().optional(),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;
