import { Injectable } from '@nestjs/common';
import { TransferResponse, CreateTransferInput, parseIsoDate } from '@fintrack/shared';
import { TransfersRepository } from './transfers.repository';
import { AccountsRepository } from '../accounts/accounts.repository';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import {
  NotFoundDomainException,
  SameAccountTransferException,
} from '../../common/exceptions/domain.exception';
import { ClockService } from '../../infra/clock/clock.service';

@Injectable()
export class TransfersService {
  constructor(
    private readonly repository: TransfersRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly balanceService: BalanceService,
    private readonly balanceGuardService: BalanceGuardService,
    private readonly clock: ClockService,
  ) {}

  async create(userId: string, dto: CreateTransferInput): Promise<TransferResponse> {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new SameAccountTransferException();
    }

    await this.clock.assertNotFuture(userId, dto.date);
    const txDate = parseIsoDate(dto.date);

    const [fromAccount, toAccount] = await Promise.all([
      this.accountsRepository.findById(userId, dto.fromAccountId),
      this.accountsRepository.findById(userId, dto.toAccountId),
    ]);

    if (!fromAccount) {
      throw new NotFoundDomainException('Chiqim hisobi topilmadi');
    }
    if (!toAccount) {
      throw new NotFoundDomainException('Kirim hisobi topilmadi');
    }

    const amount = BigInt(dto.amount);

    // Enforce strictMode on source account
    await this.balanceGuardService.assertSufficient(userId, dto.fromAccountId, amount);

    const { transferGroupId, outTx, inTx } = await this.repository.createTransfer(userId, {
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount,
      date: txDate,
      note: dto.note,
    });

    await this.balanceService.invalidate(userId);

    const [fromBalance, toBalance, totalBalance] = await Promise.all([
      this.balanceService.getBalance(userId, dto.fromAccountId),
      this.balanceService.getBalance(userId, dto.toAccountId),
      this.balanceService.getTotalBalance(userId),
    ]);

    return {
      transferGroupId,
      out: {
        id: outTx.id,
        type: 'TRANSFER_OUT',
        accountId: outTx.accountId,
        amount: outTx.amount.toString(),
      },
      in: {
        id: inTx.id,
        type: 'TRANSFER_IN',
        accountId: inTx.accountId,
        amount: inTx.amount.toString(),
      },
      balances: {
        [dto.fromAccountId]: fromBalance.toString(),
        [dto.toAccountId]: toBalance.toString(),
        total: totalBalance.toString(),
      },
    };
  }

  async delete(userId: string, transferGroupId: string): Promise<void> {
    const deletedCount = await this.repository.deleteTransfer(userId, transferGroupId);
    if (deletedCount === 0) {
      throw new NotFoundDomainException('O‘tkazma topilmadi');
    }

    await this.balanceService.invalidate(userId);
  }
}
