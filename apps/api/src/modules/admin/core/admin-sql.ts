import { Prisma } from '@prisma/client';

/**
 * Ledger rows that count as one entry, for a transactions alias `t`: live rows only (an entry
 * made and deleted again is not one, so a window never counts more than the total), opening
 * balances are not entries, and a transfer (two rows) is one.
 */
export const ENTRY = Prisma.sql`t."deleted_at" IS NULL AND t."type" NOT IN ('ADJUSTMENT', 'TRANSFER_IN')`;
