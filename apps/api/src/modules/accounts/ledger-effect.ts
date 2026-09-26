import { TransactionType } from '@prisma/client';

const CREDIT_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'INCOME',
  'TRANSFER_IN',
  'LOAN_TAKEN',
  'LOAN_REPAY_IN',
]);

const DEBIT_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'EXPENSE',
  'TRANSFER_OUT',
  'LOAN_GIVEN',
  'LOAN_REPAY_OUT',
]);

/** Signed effect of one ledger row on its account balance (mirrors SIGNED_AMOUNT_SQL). */
export function signedAmount(type: TransactionType, amount: bigint): bigint {
  if (CREDIT_TYPES.has(type)) return amount;
  if (DEBIT_TYPES.has(type)) return -amount;
  return 0n;
}

export interface LedgerRowRef {
  accountId: string;
  type: TransactionType;
  amount: bigint;
}

/**
 * Net balance change per account when `removed` rows leave the ledger and `added` rows enter it.
 * Negative entries are the debits strict mode has to check.
 */
export function balanceDeltas(removed: LedgerRowRef[], added: LedgerRowRef[]): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  const bump = (accountId: string, delta: bigint) =>
    deltas.set(accountId, (deltas.get(accountId) ?? 0n) + delta);

  for (const row of removed) bump(row.accountId, -signedAmount(row.type, row.amount));
  for (const row of added) bump(row.accountId, signedAmount(row.type, row.amount));
  return deltas;
}
