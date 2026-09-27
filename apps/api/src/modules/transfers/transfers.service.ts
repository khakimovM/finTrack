import { Injectable } from '@nestjs/common';
import { TransferResponse, CreateTransferInput, parseIsoDate } from '@fintrack/shared';
import { TransfersRepository } from './transfers.repository';
import { AccountAccessService } from '../accounts/account-access.service';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import { balanceDeltas } from '../accounts/ledger-effect';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ClockService } from '../../infra/clock/clock.service';
import {
  NotFoundDomainException,
  SameAccountTransferException,
} from '../../common/exceptions/domain.exception';

@Injectable()
export class TransfersService {
  constructor(
    private readonly repository: TransfersRepository,
    private readonly accountAccess: AccountAccessService,
    private readonly balanceService: BalanceService,
    private readonly balanceGuard: BalanceGuardService,
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
  ) {}

  async create(userId: string, dto: CreateTransferInput): Promise<TransferResponse> {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new SameAccountTransferException();
    }

    await this.clock.assertNotFuture(userId, dto.date);
    await Promise.all([
      this.accountAccess.assertWritable(userId, dto.fromAccountId, 'Chiqim hisobi topilmadi'),
      this.accountAccess.assertWritable(userId, dto.toAccountId, 'Kirim hisobi topilmadi'),
    ]);

    const amount = BigInt(dto.amount);
    const { transferGroupId, outTx, inTx } = await this.prisma.$transaction(async (db) => {
      await this.balanceGuard.assertCanDebit(db, userId, dto.fromAccountId, amount);
      return this.repository.createTransfer(db, userId, {
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amount,
        date: parseIsoDate(dto.date),
        note: dto.note,
      });
    });

    await this.balanceService.invalidate(userId, [dto.fromAccountId]);
    const { balances, total } = await this.balanceService.getAccountBalances(userId);

    return {
      transferGroupId,
      out: { id: outTx.id, type: 'TRANSFER_OUT', accountId: outTx.accountId, amount: outTx.amount.toString() },
      in: { id: inTx.id, type: 'TRANSFER_IN', accountId: inTx.accountId, amount: inTx.amount.toString() },
      balances: {
        [dto.fromAccountId]: (balances.get(dto.fromAccountId) ?? 0n).toString(),
        [dto.toAccountId]: (balances.get(dto.toAccountId) ?? 0n).toString(),
        total: total.toString(),
      },
    };
  }

  /** Deleting takes the money back out of the destination account, so strict mode applies there. */
  async delete(userId: string, transferGroupId: string): Promise<void> {
    const legs = await this.repository.findLiveLegs(userId, transferGroupId);
    if (legs.length === 0) {
      throw new NotFoundDomainException('O‘tkazma topilmadi');
    }

    const deltas = balanceDeltas(legs, []);
    await this.prisma.$transaction(async (db) => {
      await this.balanceGuard.assertDeltas(db, userId, deltas);
      await this.repository.softDeleteGroup(db, userId, transferGroupId);
    });

    await this.balanceService.invalidate(
      userId,
      legs.map((l) => l.accountId),
    );
  }
}
