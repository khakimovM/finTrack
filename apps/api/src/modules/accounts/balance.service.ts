import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

interface RawBalanceRow {
  id: string;
  balance: bigint | string | number;
}

interface CachedBalanceData {
  balances: Record<string, string>;
  total: string;
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getCacheKey(userId: string): string {
    return `balance:${userId}`;
  }

  /**
   * Returns a Map of accountId -> balance (in tiyin as BigInt) and the user's total balance.
   * Utilizes Redis caching with automatic DB recalculation on cache miss.
   */
  async getAccountBalances(userId: string): Promise<{ balances: Map<string, bigint>; total: bigint }> {
    const cacheKey = this.getCacheKey(userId);
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      try {
        const parsed: CachedBalanceData = JSON.parse(cached);
        const balances = new Map<string, bigint>();
        for (const [accId, balStr] of Object.entries(parsed.balances)) {
          balances.set(accId, BigInt(balStr));
        }
        return {
          balances,
          total: BigInt(parsed.total),
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to parse cached balances for ${userId}: ${msg}`);
      }
    }

    // Cache miss or invalid cache -> compute from PostgreSQL ledger
    const rows = await this.prisma.$queryRaw<RawBalanceRow[]>`
      SELECT a.id,
        a.opening_balance + COALESCE(SUM(
          CASE
            WHEN t.type IN ('INCOME', 'TRANSFER_IN', 'LOAN_TAKEN', 'LOAN_REPAY_IN')
              THEN t.amount
            WHEN t.type IN ('EXPENSE', 'TRANSFER_OUT', 'LOAN_GIVEN', 'LOAN_REPAY_OUT')
              THEN -t.amount
            ELSE 0
          END
        ), 0) AS balance
      FROM accounts a
      LEFT JOIN transactions t
        ON t.account_id = a.id AND t.deleted_at IS NULL
      WHERE a.user_id = ${userId} AND a.deleted_at IS NULL
      GROUP BY a.id, a.opening_balance;
    `;

    const balances = new Map<string, bigint>();
    let total = 0n;

    for (const row of rows) {
      const bal = BigInt(row.balance);
      balances.set(row.id, bal);
      total += bal;
    }

    // Save to Redis
    const cachePayload: CachedBalanceData = {
      balances: Object.fromEntries(
        Array.from(balances.entries()).map(([k, v]) => [k, v.toString()]),
      ),
      total: total.toString(),
    };

    await this.redisService.set(cacheKey, JSON.stringify(cachePayload), this.CACHE_TTL_SECONDS);

    return { balances, total };
  }

  /**
   * Returns the balance for a specific account.
   */
  async getBalance(userId: string, accountId: string): Promise<bigint> {
    const { balances } = await this.getAccountBalances(userId);
    return balances.get(accountId) ?? 0n;
  }

  /**
   * Returns the user's total net balance across all non-deleted accounts.
   */
  async getTotalBalance(userId: string): Promise<bigint> {
    const { total } = await this.getAccountBalances(userId);
    return total;
  }

  /**
   * Invalidates the user's cached balance. Must be called on any ledger write,
   * account creation, or opening balance update.
   */
  async invalidate(userId: string): Promise<void> {
    await Promise.all([
      this.redisService.del(this.getCacheKey(userId)),
      this.redisService.delPattern(`stats:${userId}:*`),
    ]);
  }
}

