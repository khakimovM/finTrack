import { BalanceGuardService } from '../balance-guard.service';
import { BalanceRepository } from '../balance.repository';
import { Db } from '../../../infra/prisma/prisma.types';
import {
  InsufficientBalanceException,
  NotFoundDomainException,
} from '../../../common/exceptions/domain.exception';

describe('BalanceGuardService', () => {
  const db = {} as Db;
  let repository: jest.Mocked<Pick<BalanceRepository, 'isStrictMode' | 'lockAndGetBalance'>>;
  let guard: BalanceGuardService;

  beforeEach(() => {
    repository = {
      isStrictMode: jest.fn(),
      lockAndGetBalance: jest.fn(),
    };
    guard = new BalanceGuardService(repository as unknown as BalanceRepository);
  });

  describe('assertCanDebit', () => {
    it('allows any debit when strict mode is off, without taking a lock', async () => {
      repository.isStrictMode.mockResolvedValue(false);

      await expect(guard.assertCanDebit(db, 'u1', 'a1', 500_000n)).resolves.toBeUndefined();
      expect(repository.lockAndGetBalance).not.toHaveBeenCalled();
    });

    it('allows the debit when the locked balance covers it exactly', async () => {
      repository.isStrictMode.mockResolvedValue(true);
      repository.lockAndGetBalance.mockResolvedValue(500_000n);

      await expect(guard.assertCanDebit(db, 'u1', 'a1', 500_000n)).resolves.toBeUndefined();
      expect(repository.lockAndGetBalance).toHaveBeenCalledWith(db, 'u1', 'a1');
    });

    it('rejects with INSUFFICIENT_BALANCE and the documented details', async () => {
      repository.isStrictMode.mockResolvedValue(true);
      repository.lockAndGetBalance.mockResolvedValue(300_000n);

      const error = await guard.assertCanDebit(db, 'u1', 'a1', 500_000n).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(InsufficientBalanceException);
      expect(error).toMatchObject({
        code: 'INSUFFICIENT_BALANCE',
        status: 422,
        details: { accountId: 'a1', currentBalance: '300000', requested: '500000' },
      });
    });

    it('returns 404 when the account is not the user’s', async () => {
      repository.isStrictMode.mockResolvedValue(true);
      repository.lockAndGetBalance.mockResolvedValue(null);

      await expect(guard.assertCanDebit(db, 'u1', 'a1', 1n)).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });

    it('ignores zero and negative amounts', async () => {
      await guard.assertCanDebit(db, 'u1', 'a1', 0n);
      expect(repository.isStrictMode).not.toHaveBeenCalled();
    });
  });

  describe('assertDeltas', () => {
    it('checks only decreasing accounts, in a stable lock order', async () => {
      repository.isStrictMode.mockResolvedValue(true);
      repository.lockAndGetBalance.mockResolvedValue(10_000n);

      await guard.assertDeltas(
        db,
        'u1',
        new Map([
          ['b-acc', -100n],
          ['a-acc', -200n],
          ['c-acc', 500n],
        ]),
      );

      expect(repository.lockAndGetBalance.mock.calls.map((c) => c[2])).toEqual(['a-acc', 'b-acc']);
    });
  });
});
