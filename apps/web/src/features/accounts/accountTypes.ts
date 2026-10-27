import type { AccountType } from '@fintrack/shared';
import type { TextKey } from '../../lib/i18n';

/** short: card subtitle ("Karta"); long: the form's type tiles ("Bank kartasi"). */
export const ACCOUNT_TYPES: Record<AccountType, { short: TextKey; long: TextKey; emoji: string }> = {
  CARD: { short: 'accounts.types.CARD.short', long: 'accounts.types.CARD.long', emoji: '💳' },
  CASH: { short: 'accounts.types.CASH.short', long: 'accounts.types.CASH.long', emoji: '💵' },
  BANK: { short: 'accounts.types.BANK.short', long: 'accounts.types.BANK.long', emoji: '🏛️' },
  SAVINGS: { short: 'accounts.types.SAVINGS.short', long: 'accounts.types.SAVINGS.long', emoji: '🐷' },
};

export const ACCOUNT_EMOJIS = ['💳', '💵', '🏦', '🏛️', '🐷', '💰', '👛', '🪙', '💼', '💎', '📈', '🧾', '🏠', '🚗', '✈️', '🎓', '🎁', '📱'] as const;
