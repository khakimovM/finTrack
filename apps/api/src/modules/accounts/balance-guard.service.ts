import { Injectable } from '@nestjs/common';
import { Db } from '../../infra/prisma/prisma.types';
import {
  InsufficientBalanceException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { BalanceRepository } from './balance.repository';

/**
 * The single place that enforces strict mode (40-domain-money.md §5).
 * Must be called inside the `$transaction` that performs the write so the account lock taken
 * here is held until commit.
 */
@Injectable()
export class BalanceGuardService {
  constructor(private readonly repository: BalanceRepository) {}

  async assertCanDebit(db: Db, userId: string, accountId: string, amount: bigint): Promise<void> {
    if (amount <= 0n) return;
    if (!(await this.repository.isStrictMode(db, userId))) return;

    const balance = await this.repository.lockAndGetBalance(db, userId, accountId);
    if (balance === null) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }
    if (balance < amount) {
      throw new InsufficientBalanceException('Balansingiz yetarli emas', {
        accountId,
        currentBalance: balance.toString(),
        requested: amount.toString(),
      });
    }
  }

  /** Applies strict mode to every account whose balance would decrease (`delta < 0`). */
  async assertDeltas(db: Db, userId: string, deltas: Map<string, bigint>): Promise<void> {
    // Lock in a stable order so two multi-account operations cannot deadlock each other.
    const debits = [...deltas.entries()]
      .filter(([, delta]) => delta < 0n)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [accountId, delta] of debits) {
      await this.assertCanDebit(db, userId, accountId, -delta);
    }
  }
}
