import type { AccountType } from '@fintrack/shared';

/** short: card subtitle ("Karta"); long: the form's type tiles ("Bank kartasi"). */
export const ACCOUNT_TYPES: Record<AccountType, { short: string; long: string; emoji: string }> = {
  CARD: { short: 'Karta', long: 'Bank kartasi', emoji: '💳' },
  CASH: { short: 'Naqd', long: 'Naqd pul', emoji: '💵' },
  BANK: { short: 'Bank', long: 'Bank hisob raqami', emoji: '🏛️' },
  SAVINGS: { short: 'Jamg‘arma', long: 'Jamg‘arma / Depozit', emoji: '🐷' },
};

export const ACCOUNT_EMOJIS = ['💳', '💵', '🏦', '🏛️', '🐷', '💰', '👛', '🪙', '💼', '💎', '📈', '🧾', '🏠', '🚗', '✈️', '🎓', '🎁', '📱'] as const;
