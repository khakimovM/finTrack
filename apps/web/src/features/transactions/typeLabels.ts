import type { TransactionType } from '@fintrack/shared';

/** How each ledger entry type is named in lists and filters. */
export const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Kirim',
  EXPENSE: 'Chiqim',
  TRANSFER_IN: 'O‘tkazma (kirim)',
  TRANSFER_OUT: 'O‘tkazma (chiqim)',
  LOAN_GIVEN: 'Qarz berildi',
  LOAN_TAKEN: 'Qarz olindi',
  LOAN_REPAY_IN: 'Qarz qaytarildi',
  LOAN_REPAY_OUT: 'Qarz to‘landi',
  ADJUSTMENT: 'Tuzatish',
};
