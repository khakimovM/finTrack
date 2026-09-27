import { Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import {
  CreateDebtPaymentInput,
  DebtPaymentResponse,
  DebtResponse,
  SettleDebtInput,
  parseIsoDate,
} from '@fintrack/shared';
import { DebtsRepository } from './debts.repository';
import { debtStatusFor, toDebtPaymentResponse, toDebtResponse } from './debt.mapper';
import { AccountAccessService } from '../accounts/account-access.service';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import { balanceDeltas } from '../accounts/ledger-effect';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ClockService } from '../../infra/clock/clock.service';
import {
  ConflictDomainException,
  DebtOverpaymentException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';

export interface CreatePaymentResult {
  payment: DebtPaymentResponse;
  debt: DebtResponse;
  transaction: { id: string; type: TransactionType; amount: string };
  totalBalance: string;
}

interface PaymentRequest {
  /** `null` settles whatever is left on the debt. */
  amount: bigint | null;
  accountId: string;
  paidAt?: string | null;
  note?: string | null;
}

@Injectable()
export class DebtPaymentsService {
  constructor(
    private readonly repository: DebtsRepository,
    private readonly accountAccess: AccountAccessService,
    private readonly balanceService: BalanceService,
    private readonly balanceGuard: BalanceGuardService,
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
  ) {}

  async listPayments(userId: string, debtId: string): Promise<DebtPaymentResponse[]> {
    const debt = await this.repository.findById(userId, debtId);
    if (!debt) throw new NotFoundDomainException('Qarz topilmadi');
    const payments = await this.repository.findPayments(userId, debtId);
    return payments.map(toDebtPaymentResponse);
  }

  async createPayment(
    userId: string,
    debtId: string,
    dto: CreateDebtPaymentInput,
  ): Promise<CreatePaymentResult> {
    return this.pay(userId, debtId, { ...dto, amount: BigInt(dto.amount) });
  }

  async settle(userId: string, debtId: string, dto: SettleDebtInput): Promise<CreatePaymentResult> {
    return this.pay(userId, debtId, { ...dto, amount: null, note: dto.note ?? 'To‘liq yopildi' });
  }

  /**
   * The debt row is locked before the remaining amount is computed, so two concurrent payments
   * cannot both pass the overpayment check. Status and paidAt change in the same transaction.
   */
  private async pay(
    userId: string,
    debtId: string,
    request: PaymentRequest,
  ): Promise<CreatePaymentResult> {
    const today = await this.clock.todayFor(userId);
    const paidAt = request.paidAt ?? today;
    await this.clock.assertNotFuture(userId, paidAt);
    await this.accountAccess.assertWritable(userId, request.accountId);

    const result = await this.prisma.$transaction(async (db) => {
      const debt = await this.repository.lock(db, userId, debtId);
      if (!debt) throw new NotFoundDomainException('Qarz topilmadi');

      const paid = await this.repository.paidAmount(db, debtId);
      const remaining = debt.amount > paid ? debt.amount - paid : 0n;
      if (remaining === 0n) {
        throw new ConflictDomainException(
          'DEBT_ALREADY_PAID',
          'Ushbu qarz allaqachon to‘liq to‘langan',
        );
      }

      const amount = request.amount ?? remaining;
      if (amount > remaining) {
        throw new DebtOverpaymentException('Qoldiqdan ortiqcha to‘lov kiritib bo‘lmaydi', {
          remainingAmount: remaining.toString(),
          requested: amount.toString(),
        });
      }

      // Repaying what I borrowed is money leaving my account.
      if (debt.direction === 'I_BORROWED') {
        await this.balanceGuard.assertCanDebit(db, userId, request.accountId, amount);
      }

      const { payment, transaction } = await this.repository.createPayment(db, userId, debtId, {
        accountId: request.accountId,
        amount,
        type: debt.direction === 'I_LENT' ? 'LOAN_REPAY_IN' : 'LOAN_REPAY_OUT',
        paidAt: parseIsoDate(paidAt),
        note: request.note,
      });

      const status = debtStatusFor(debt.amount, paid + amount);
      const updatedDebt = await this.repository.setStatus(
        db,
        userId,
        debtId,
        status,
        status === 'PAID' ? new Date() : null,
      );
      return { payment, transaction, updatedDebt };
    });

    await this.balanceService.invalidate(userId, [request.accountId]);
    const totalBalance = await this.balanceService.getTotalBalance(userId);

    return {
      payment: toDebtPaymentResponse(result.payment),
      debt: toDebtResponse(result.updatedDebt, today),
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount.toString(),
      },
      totalBalance: totalBalance.toString(),
    };
  }

  /** Undoes one payment: its ledger row is reversed and the debt status recomputed. */
  async deletePayment(userId: string, debtId: string, paymentId: string): Promise<DebtResponse> {
    const updated = await this.prisma.$transaction(async (db) => {
      const debt = await this.repository.lock(db, userId, debtId);
      if (!debt) throw new NotFoundDomainException('Qarz topilmadi');

      const payment = await this.repository.findPayment(db, userId, debtId, paymentId);
      if (!payment) throw new NotFoundDomainException('To‘lov topilmadi');

      await this.balanceGuard.assertDeltas(db, userId, balanceDeltas([payment.transaction], []));
      await this.repository.deletePayment(db, userId, payment);

      const paid = await this.repository.paidAmount(db, debtId);
      const debtAfter = await this.repository.setStatus(db, userId, debtId, debtStatusFor(debt.amount, paid), null);
      return { debtAfter, accountId: payment.transaction.accountId };
    });

    await this.balanceService.invalidate(userId, [updated.accountId]);
    return toDebtResponse(updated.debtAfter, await this.clock.todayFor(userId));
  }
}
