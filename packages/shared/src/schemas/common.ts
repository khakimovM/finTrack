import { z } from 'zod';
import { diffInDays, isValidIsoDate } from '../date';

/** 18 digits keeps every amount (and sums of a few of them) far below Postgres BIGINT (9.22e18). */
const MAX_AMOUNT_DIGITS = 18;

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, { message: 'Sana YYYY-MM-DD formatida va haqiqiy sana bo‘lishi kerak' });

/** Strictly positive amount in tiyin, transported as a string. */
export const positiveTiyinSchema = z
  .string()
  .regex(
    new RegExp(`^[1-9]\\d{0,${MAX_AMOUNT_DIGITS - 1}}$`),
    'Summa 0 dan katta butun tiyin bo‘lishi kerak',
  );

/** Non-negative amount in tiyin (filters). */
export const nonNegativeTiyinSchema = z
  .string()
  .regex(new RegExp(`^\\d{1,${MAX_AMOUNT_DIGITS}}$`), 'Summa manfiy bo‘lmagan butun tiyin bo‘lishi kerak');

/** Signed amount in tiyin (opening balances may be negative, e.g. a credit card). */
export const signedTiyinSchema = z
  .string()
  .regex(new RegExp(`^-?\\d{1,${MAX_AMOUNT_DIGITS}}$`), 'Summa butun tiyin bo‘lishi kerak');

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Rang hex formatida bo‘lishi kerak (#rrggbb)');

export const iconSchema = z.string().trim().min(1).max(16, 'Ikonka juda uzun');

export const noteSchema = z.string().trim().max(500, 'Izoh 500 belgidan oshmasligi kerak');

export const searchSchema = z.string().trim().max(100, 'Qidiruv matni juda uzun');

/** Multi-currency is Phase 13; until then every account is in UZS so totals stay meaningful. */
export const currencySchema = z.literal('UZS', {
  errorMap: () => ({ message: 'Hozircha faqat UZS valyutasi qo‘llab-quvvatlanadi' }),
});

/**
 * Adds `from <= to` and an optional maximum span check to an object schema with ISO dates.
 * Unbounded ranges let one request generate millions of zero-filled buckets.
 */
export function refineDateRange<T extends { from?: string; to?: string }>(
  value: T,
  ctx: z.RefinementCtx,
  maxDays?: number,
): void {
  if (!value.from || !value.to || !isValidIsoDate(value.from) || !isValidIsoDate(value.to)) return;
  const span = diffInDays(value.from, value.to);
  if (span < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to'],
      message: 'Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas',
    });
  } else if (maxDays !== undefined && span > maxDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to'],
      message: `Sana oralig‘i ${maxDays} kundan oshmasligi kerak`,
    });
  }
}

/**
 * HTML inputs submit "" for an untouched optional field; treat it as "not provided" (null)
 * instead of failing the inner validator.
 */
export function emptyToNull<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === '' ? null : v), schema.nullable().optional());
}
