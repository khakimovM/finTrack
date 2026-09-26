import { Test, TestingModule } from '@nestjs/testing';
import { BalanceGuardService } from '../balance-guard.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BalanceService } from '../balance.service';
import { InsufficientBalanceException } from '../../../common/exceptions/domain.exception';

describe('BalanceGuardService', () => {
  let service: BalanceGuardService;
  let prisma: { user: { findUnique: jest.Mock } };
  let balanceService: { getBalance: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    balanceService = {
      getBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceGuardService,
        { provide: PrismaService, useValue: prisma },
        { provide: BalanceService, useValue: balanceService },
      ],
    }).compile();

    service = module.get<BalanceGuardService>(BalanceGuardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertSufficient', () => {
    const userId = 'user-1';
    const accountId = 'acc-1';

    it('allows negative balance when strictMode is false', async () => {
      prisma.user.findUnique.mockResolvedValue({ strictMode: false });

      await expect(
        service.assertSufficient(userId, accountId, 500000n),
      ).resolves.toBeUndefined();

      expect(balanceService.getBalance).not.toHaveBeenCalled();
    });

    it('allows transaction when strictMode is true and balance is sufficient', async () => {
      prisma.user.findUnique.mockResolvedValue({ strictMode: true });
      balanceService.getBalance.mockResolvedValue(1000000n);

      await expect(
        service.assertSufficient(userId, accountId, 500000n),
      ).resolves.toBeUndefined();

      expect(balanceService.getBalance).toHaveBeenCalledWith(userId, accountId);
    });

    it('throws 422 INSUFFICIENT_BALANCE when strictMode is true and balance is insufficient', async () => {
      prisma.user.findUnique.mockResolvedValue({ strictMode: true });
      balanceService.getBalance.mockResolvedValue(300000n);

      await expect(
        service.assertSufficient(userId, accountId, 500000n),
      ).rejects.toThrow(InsufficientBalanceException);

      try {
        await service.assertSufficient(userId, accountId, 500000n);
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientBalanceException);
        const exc = err as InsufficientBalanceException;
        expect(exc.code).toBe('INSUFFICIENT_BALANCE');
        expect(exc.details).toEqual({
          accountId,
          currentBalance: '300000',
          requested: '500000',
        });
      }
    });
  });
});
