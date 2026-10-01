import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';
import { SIGNED_AMOUNT_SQL, toBigInt } from '../../infra/prisma/ledger-sql';

interface BalanceRow {
  id: string;
  balance: bigint | string | number;
}

@Injectable()
export class BalanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Balance of every live account: opening balance + signed sum of live ledger rows. */
  async balancesByAccount(userId: string, db: Db = this.prisma): Promise<Map<string, bigint>> {
    const rows = await db.$queryRaw<BalanceRow[]>`
      SELECT a.id, a.opening_balance + COALESCE(SUM(${SIGNED_AMOUNT_SQL}), 0) AS balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
      WHERE a.user_id = ${userId} AND a.deleted_at IS NULL
      GROUP BY a.id, a.opening_balance
    `;
    return new Map(rows.map((r) => [r.id, toBigInt(r.balance)]));
  }

  /**
   * Locks the account row for the rest of the surrounding transaction and returns its balance
   * computed from committed ledger rows. Concurrent debits on the same account queue behind the
   * lock, so a strict-mode check cannot be raced. Returns null when the account is not the user's.
   */
  async lockAndGetBalance(db: Db, userId: string, accountId: string): Promise<bigint | null> {
    const locked = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM accounts
      WHERE id = ${accountId} AND user_id = ${userId} AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (locked.length === 0) return null;

    const rows = await db.$queryRaw<{ balance: bigint | string | number }[]>`
      SELECT a.opening_balance + COALESCE(SUM(${SIGNED_AMOUNT_SQL}), 0) AS balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
      WHERE a.id = ${accountId} AND a.user_id = ${userId}
      GROUP BY a.id, a.opening_balance
    `;
    return toBigInt(rows[0]?.balance);
  }

  async isStrictMode(db: Db, userId: string): Promise<boolean> {
    const user = await db.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { strictMode: true },
    });
    return user?.strictMode ?? false;
  }
}
