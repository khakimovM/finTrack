import { Prisma } from '@prisma/client';

/**
 * Ledger rows that count as one entry, for a transactions alias `t`: opening balances are not
 * entries, and a transfer (two rows) is one.
 */
export const ENTRY = Prisma.sql`t."type" NOT IN ('ADJUSTMENT', 'TRANSFER_IN')`;
