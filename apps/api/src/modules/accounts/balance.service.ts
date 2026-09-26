import { Injectable } from '@nestjs/common';
import { UserCacheService } from '../../infra/redis/user-cache.service';
import { BalanceRepository } from './balance.repository';

export interface AccountBalances {
  balances: Map<string, bigint>;
  total: bigint;
}

const CACHE_TTL_SECONDS = 3600;

const balancesCodec = {
  encode: (value: AccountBalances) =>
    JSON.stringify({
      balances: Object.fromEntries([...value.balances].map(([id, b]) => [id, b.toString()])),
      total: value.total.toString(),
    }),
  decode: (raw: string): AccountBalances => {
    const parsed = JSON.parse(raw) as { balances: Record<string, string>; total: string };
    return {
      balances: new Map(Object.entries(parsed.balances).map(([id, b]) => [id, BigInt(b)])),
      total: BigInt(parsed.total),
    };
  },
};

/** Read side of balances: derived from the ledger, cached per user (never stored). */
@Injectable()
export class BalanceService {
  constructor(
    private readonly repository: BalanceRepository,
    private readonly cache: UserCacheService,
  ) {}

  async getAccountBalances(userId: string): Promise<AccountBalances> {
    return this.cache.remember(
      userId,
      'balances',
      CACHE_TTL_SECONDS,
      async () => {
        const balances = await this.repository.balancesByAccount(userId);
        let total = 0n;
        for (const balance of balances.values()) total += balance;
        return { balances, total };
      },
      balancesCodec,
    );
  }

  async getBalance(userId: string, accountId: string): Promise<bigint> {
    const { balances } = await this.getAccountBalances(userId);
    return balances.get(accountId) ?? 0n;
  }

  async getTotalBalance(userId: string): Promise<bigint> {
    const { total } = await this.getAccountBalances(userId);
    return total;
  }

  /** Must be called after every committed ledger or account write. */
  async invalidate(userId: string): Promise<void> {
    await this.cache.invalidate(userId);
  }
}
