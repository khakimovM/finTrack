import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from '../balance.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';

describe('BalanceService', () => {
  let service: BalanceService;
  let prisma: { $queryRaw: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock; delPattern: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delPattern: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccountBalances', () => {
    const userId = 'user-123';

    it('returns cached balances if available in Redis without calling DB', async () => {
      const cachedData = JSON.stringify({
        balances: {
          'acc-1': '100000',
          'acc-2': '250000',
        },
        total: '350000',
      });
      redis.get.mockResolvedValue(cachedData);

      const result = await service.getAccountBalances(userId);

      expect(redis.get).toHaveBeenCalledWith(`balance:${userId}`);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(result.balances.get('acc-1')).toBe(100000n);
      expect(result.balances.get('acc-2')).toBe(250000n);
      expect(result.total).toBe(350000n);
    });

    it('computes balances from DB on cache miss and stores in Redis', async () => {
      redis.get.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'acc-1', balance: '1500000' },
        { id: 'acc-2', balance: '2500000' },
      ]);

      const result = await service.getAccountBalances(userId);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result.balances.get('acc-1')).toBe(1500000n);
      expect(result.balances.get('acc-2')).toBe(2500000n);
      expect(result.total).toBe(4000000n);

      expect(redis.set).toHaveBeenCalledWith(
        `balance:${userId}`,
        JSON.stringify({
          balances: { 'acc-1': '1500000', 'acc-2': '2500000' },
          total: '4000000',
        }),
        3600,
      );
    });
  });

  describe('getBalance', () => {
    it('returns balance for specified account', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          balances: { 'acc-1': '50000' },
          total: '50000',
        }),
      );

      const bal = await service.getBalance('user-1', 'acc-1');
      expect(bal).toBe(50000n);

      const unknownBal = await service.getBalance('user-1', 'unknown');
      expect(unknownBal).toBe(0n);
    });
  });

  describe('getTotalBalance', () => {
    it('returns total balance across all accounts', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({
          balances: { 'acc-1': '50000', 'acc-2': '70000' },
          total: '120000',
        }),
      );

      const total = await service.getTotalBalance('user-1');
      expect(total).toBe(120000n);
    });
  });

  describe('9 transaction types impact on balance', () => {
    it('correctly classifies signs of all 9 transaction types in balance calculation', () => {
      // Invariant:
      // Positive (+): INCOME, TRANSFER_IN, LOAN_TAKEN, LOAN_REPAY_IN
      // Negative (-): EXPENSE, TRANSFER_OUT, LOAN_GIVEN, LOAN_REPAY_OUT
      // ADJUSTMENT: signed
      const positiveTypes = ['INCOME', 'TRANSFER_IN', 'LOAN_TAKEN', 'LOAN_REPAY_IN'];
      const negativeTypes = ['EXPENSE', 'TRANSFER_OUT', 'LOAN_GIVEN', 'LOAN_REPAY_OUT'];

      let computedBalance = 0n;
      const openingBalance = 100000n;
      computedBalance += openingBalance;

      // Add 10000 for each positive type
      for (const type of positiveTypes) {
        const sign = ['INCOME', 'TRANSFER_IN', 'LOAN_TAKEN', 'LOAN_REPAY_IN'].includes(type) ? 1n : -1n;
        computedBalance += sign * 10000n;
      }
      expect(computedBalance).toBe(100000n + 40000n);

      // Subtract 5000 for each negative type
      for (const type of negativeTypes) {
        const sign = ['EXPENSE', 'TRANSFER_OUT', 'LOAN_GIVEN', 'LOAN_REPAY_OUT'].includes(type) ? -1n : 1n;
        computedBalance += sign * 5000n;
      }
      expect(computedBalance).toBe(140000n - 20000n); // 120000n
    });
  });

  describe('invalidate', () => {
    it('deletes the redis cache key for the user and invalidates stats pattern', async () => {
      await service.invalidate('user-999');
      expect(redis.del).toHaveBeenCalledWith('balance:user-999');
      expect(redis.delPattern).toHaveBeenCalledWith('stats:user-999:*');
    });
  });
});
