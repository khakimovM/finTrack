import { BalanceService } from '../balance.service';
import { BalanceRepository } from '../balance.repository';
import { UserCacheService } from '../../../infra/redis/user-cache.service';
import { RedisService } from '../../../infra/redis/redis.service';

class FakeRedis {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
    return 'OK' as const;
  }
  async incr(key: string) {
    const next = Number(this.store.get(key) ?? '0') + 1;
    this.store.set(key, String(next));
    return next;
  }
}

describe('BalanceService', () => {
  let repository: { balancesByAccount: jest.Mock };
  let service: BalanceService;

  beforeEach(() => {
    repository = {
      balancesByAccount: jest.fn().mockResolvedValue(
        new Map([
          ['acc-1', 1_500_000n],
          ['acc-2', -250_000n],
        ]),
      ),
    };
    const cache = new UserCacheService(new FakeRedis() as unknown as RedisService);
    service = new BalanceService(repository as unknown as BalanceRepository, cache);
  });

  it('derives the total from per-account ledger balances (negative balances included)', async () => {
    const result = await service.getAccountBalances('u1');
    expect(result.balances.get('acc-1')).toBe(1_500_000n);
    expect(result.total).toBe(1_250_000n);
  });

  it('serves repeated reads from the cache as BigInt values', async () => {
    await service.getAccountBalances('u1');
    const second = await service.getAccountBalances('u1');

    expect(repository.balancesByAccount).toHaveBeenCalledTimes(1);
    expect(second.balances.get('acc-2')).toBe(-250_000n);
    expect(typeof second.total).toBe('bigint');
  });

  it('recomputes after invalidate()', async () => {
    await service.getAccountBalances('u1');
    repository.balancesByAccount.mockResolvedValue(new Map([['acc-1', 10n]]));

    await service.invalidate('u1');
    expect(await service.getTotalBalance('u1')).toBe(10n);
    expect(repository.balancesByAccount).toHaveBeenCalledTimes(2);
  });

  it('returns 0 for an unknown account', async () => {
    expect(await service.getBalance('u1', 'missing')).toBe(0n);
  });
});
