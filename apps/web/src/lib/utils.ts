import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatMoney } from '@fintrack/shared';

/**
 * Combines Tailwind classes with clsx and twMerge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a raw tiyin string into a display string for the UI.
 * e.g., "125000000" -> "1 250 000,00 so'm"
 */
export function formatMoneyUi(tiyinAmount: string | bigint | number): string {
  try {
    const tiyin = typeof tiyinAmount === 'bigint' ? tiyinAmount : BigInt(tiyinAmount);
    return formatMoney(tiyin);
  } catch {
    return '0,00 so\'m';
  }
}
