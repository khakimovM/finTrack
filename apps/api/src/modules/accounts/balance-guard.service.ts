import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BalanceService } from './balance.service';
import { InsufficientBalanceException } from '../../common/exceptions/domain.exception';

@Injectable()
export class BalanceGuardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
  ) {}

  /**
   * Enforces strictMode for outgoing operations.
   * If User.strictMode is false: allows balance to go negative.
   * If User.strictMode is true: throws 422 INSUFFICIENT_BALANCE when currentBalance < requestedAmount.
   */
  async assertSufficient(
    userId: string,
    accountId: string,
    requestedAmount: bigint,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { strictMode: true },
    });

    if (!user?.strictMode) {
      return;
    }

    const currentBalance = await this.balanceService.getBalance(userId, accountId);
    if (currentBalance < requestedAmount) {
      throw new InsufficientBalanceException('Balansingiz yetarli emas', {
        accountId,
        currentBalance: currentBalance.toString(),
        requested: requestedAmount.toString(),
      });
    }
  }
}
