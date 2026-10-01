import { Prisma } from '@prisma/client';

/**
 * Signed contribution of a ledger row (alias `t`) to its account balance. The single SQL
 * definition of the sign table in 40-domain-money.md — balances, guards and the balance trend
 * must all use it. ADJUSTMENT rows are never created (no sign) and contribute nothing.
 */
export const SIGNED_AMOUNT_SQL = Prisma.sql`
  CASE
    WHEN t.type IN ('INCOME', 'TRANSFER_IN', 'LOAN_TAKEN', 'LOAN_REPAY_IN') THEN t.amount
    WHEN t.type IN ('EXPENSE', 'TRANSFER_OUT', 'LOAN_GIVEN', 'LOAN_REPAY_OUT') THEN -t.amount
    ELSE 0
  END`;

/** Postgres returns SUM(bigint) as numeric; Prisma hands it back as Decimal, string, number or bigint. */
export function toBigInt(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  return BigInt(String(value));
}
