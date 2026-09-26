import { Injectable } from '@nestjs/common';
import { DebtDirection, DebtPayment, TransactionType } from '@prisma/client';
import {
  DebtResponse,
  DebtPaymentResponse,
  DebtListMeta,
  CreateDebtInput,
  UpdateDebtInput,
  CreateDebtPaymentInput,
  SettleDebtInput,
  ListDebtsQuery,
} from '@fintrack/shared';
import { DebtsRepository, DebtWithPayments } from './debts.repository';
import { AccountsRepository } from '../accounts/accounts.repository';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import {
  NotFoundDomainException,
  DebtOverpaymentException,
  ConflictDomainException,
} from '../../common/exceptions/domain.exception';

export interface CreateDebtResult {
  debt: DebtResponse;
  transaction: {
    id: string;
    type: TransactionType;
    amount: string;
  };
  totalBalance: string;
}

export interface CreatePaymentResult {
  payment: DebtPaymentResponse;
  debt: DebtResponse;
  transaction: {
    id: string;
    type: TransactionType;
    amount: string;
  };
  totalBalance: string;
}

@Injectable()
export class DebtsService {
  constructor(
    private readonly repository: DebtsRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly balanceService: BalanceService,
    private readonly balanceGuardService: BalanceGuardService,
  ) {}

  async list(
    userId: string,
    query: ListDebtsQuery,
  ): Promise<{ data: DebtResponse[]; meta: DebtListMeta }> {
    const [{ debts, total }, summary] = await Promise.all([
      this.repository.findMany(userId, query),
      this.repository.calculateSummary(userId),
    ]);

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data: debts.map((d) => this.mapToResponse(d)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        summary: {
          owedToMe: summary.owedToMe.toString(),
          iOwe: summary.iOwe.toString(),
          net: summary.net.toString(),
          overdueCount: summary.overdueCount,
        },
      },
    };
  }

  async getById(userId: string, id: string): Promise<DebtResponse> {
    const debt = await this.repository.findById(userId, id);
    if (!debt) {
      throw new NotFoundDomainException('Qarz topilmadi');
    }
    return this.mapToResponse(debt);
  }

  async create(userId: string, dto: CreateDebtInput): Promise<CreateDebtResult> {
    const account = await this.accountsRepository.findById(userId, dto.accountId);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    const amount = BigInt(dto.amount);

    if (dto.direction === 'I_LENT') {
      await this.balanceGuardService.assertSufficient(userId, dto.accountId, amount);
    }

    const { debt, transaction } = await this.repository.createDebt(userId, {
      direction: dto.direction as DebtDirection,
      personName: dto.personName,
      personPhone: dto.personPhone,
      accountId: dto.accountId,
      amount,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      note: dto.note,
    });

    await this.balanceService.invalidate(userId);
    const totalBalance = await this.balanceService.getTotalBalance(userId);

    return {
      debt: this.mapToResponse(debt),
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
      },
      totalBalance: totalBalance.toString(),
    };
  }

  async update(userId: string, id: string, dto: UpdateDebtInput): Promise<DebtResponse> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new NotFoundDomainException('Qarz topilmadi');
    }

    const updated = await this.repository.update(userId, id, {
      personName: dto.personName,
      personPhone: dto.personPhone,
      dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
      note: dto.note,
    });

    return this.mapToResponse(updated);
  }

  async createPayment(
    userId: string,
    id: string,
    dto: CreateDebtPaymentInput,
  ): Promise<CreatePaymentResult> {
    const debt = await this.repository.findById(userId, id);
    if (!debt) {
      throw new NotFoundDomainException('Qarz topilmadi');
    }

    const paidAmount = debt.payments.reduce((acc, p) => acc + p.amount, 0n);
    const remainingAmount = debt.amount > paidAmount ? debt.amount - paidAmount : 0n;

    if (remainingAmount <= 0n) {
      throw new ConflictDomainException('DEBT_ALREADY_PAID', 'Ushbu qarz allaqachon to‘liq to‘langan');
    }

    const paymentAmount = BigInt(dto.amount);
    if (paymentAmount > remainingAmount) {
      throw new DebtOverpaymentException('Qoldiqdan ortiqcha to‘lov kiritib bo‘lmaydi', {
        remainingAmount: remainingAmount.toString(),
        requested: paymentAmount.toString(),
      });
    }

    const account = await this.accountsRepository.findById(userId, dto.accountId);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    // When repaying a loan taken (I_BORROWED), money leaves account -> check strictMode
    if (debt.direction === 'I_BORROWED') {
      await this.balanceGuardService.assertSufficient(userId, dto.accountId, paymentAmount);
    }

    const newRemaining = remainingAmount - paymentAmount;
    const newStatus = newRemaining === 0n ? 'PAID' : 'PARTIALLY_PAID';
    const newPaidAt = newRemaining === 0n ? new Date() : null;
    const txType: TransactionType = debt.direction === 'I_LENT' ? 'LOAN_REPAY_IN' : 'LOAN_REPAY_OUT';

    const { payment, updatedDebt, transaction } = await this.repository.createPayment(
      userId,
      id,
      {
        accountId: dto.accountId,
        amount: paymentAmount,
        type: txType,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        note: dto.note,
      },
      newStatus,
      newPaidAt,
    );

    await this.balanceService.invalidate(userId);
    const totalBalance = await this.balanceService.getTotalBalance(userId);

    return {
      payment: this.mapPaymentToResponse(payment),
      debt: this.mapToResponse(updatedDebt),
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
      },
      totalBalance: totalBalance.toString(),
    };
  }

  async settle(userId: string, id: string, dto: SettleDebtInput): Promise<CreatePaymentResult> {
    const debt = await this.repository.findById(userId, id);
    if (!debt) {
      throw new NotFoundDomainException('Qarz topilmadi');
    }

    const paidAmount = debt.payments.reduce((acc, p) => acc + p.amount, 0n);
    const remainingAmount = debt.amount > paidAmount ? debt.amount - paidAmount : 0n;

    if (remainingAmount <= 0n) {
      throw new ConflictDomainException('DEBT_ALREADY_PAID', 'Ushbu qarz allaqachon to‘liq to‘langan');
    }

    return this.createPayment(userId, id, {
      amount: remainingAmount.toString(),
      accountId: dto.accountId,
      paidAt: dto.paidAt,
      note: dto.note ?? 'To‘liq yopildi',
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const debt = await this.repository.findById(userId, id);
    if (!debt) {
      throw new NotFoundDomainException('Qarz topilmadi');
    }

    await this.repository.softDelete(userId, id);
    await this.balanceService.invalidate(userId);
  }

  async listPayments(userId: string, id: string): Promise<DebtPaymentResponse[]> {
    const debt = await this.repository.findById(userId, id);
    if (!debt) {
      throw new NotFoundDomainException('Qarz topilmadi');
    }

    const payments = await this.repository.findPayments(userId, id);
    return payments.map((p) => this.mapPaymentToResponse(p));
  }

  private mapToResponse(debt: DebtWithPayments): DebtResponse {
    const paidAmount = (debt.payments ?? []).reduce((acc, p) => acc + p.amount, 0n);
    const remainingAmount = debt.amount > paidAmount ? debt.amount - paidAmount : 0n;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isOverdue = false;
    let daysLeft: number | null = null;

    if (debt.dueDate) {
      const due = new Date(debt.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - today.getTime();
      daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isOverdue = debt.status !== 'PAID' && due < today;
    }

    const dueDateStr = debt.dueDate
      ? debt.dueDate instanceof Date
        ? debt.dueDate.toISOString().split('T')[0]
        : String(debt.dueDate)
      : null;

    return {
      id: debt.id,
      direction: debt.direction,
      personName: debt.personName,
      personPhone: debt.personPhone,
      amount: debt.amount.toString(),
      paidAmount: paidAmount.toString(),
      remainingAmount: remainingAmount.toString(),
      dueDate: dueDateStr,
      status: debt.status,
      paidAt: debt.paidAt?.toISOString() ?? null,
      isOverdue,
      daysLeft,
      note: debt.note,
      createdAt: debt.createdAt.toISOString(),
      updatedAt: debt.updatedAt.toISOString(),
    };
  }

  private mapPaymentToResponse(payment: DebtPayment): DebtPaymentResponse {
    const paidAtStr =
      payment.paidAt instanceof Date
        ? payment.paidAt.toISOString().split('T')[0]
        : String(payment.paidAt);

    return {
      id: payment.id,
      amount: payment.amount.toString(),
      paidAt: paidAtStr,
      note: payment.note,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
