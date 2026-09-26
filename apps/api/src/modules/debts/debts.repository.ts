import { Injectable } from '@nestjs/common';
import { Debt, DebtDirection, DebtPayment, DebtStatus, Prisma, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ListDebtsQuery } from '@fintrack/shared';

export type DebtWithPayments = Debt & {
  payments: DebtPayment[];
};

export interface CreateDebtRepoData {
  direction: DebtDirection;
  personName: string;
  personPhone?: string | null;
  accountId: string;
  amount: bigint;
  dueDate?: Date | null;
  note?: string | null;
}

export interface UpdateDebtRepoData {
  personName?: string;
  personPhone?: string | null;
  dueDate?: Date | null;
  note?: string | null;
}

export interface CreatePaymentRepoData {
  accountId: string;
  amount: bigint;
  type: TransactionType;
  paidAt: Date;
  note?: string | null;
}

@Injectable()
export class DebtsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    userId: string,
    query: ListDebtsQuery,
  ): Promise<{ debts: DebtWithPayments[]; total: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: Prisma.DebtWhereInput = {
      userId,
      deletedAt: null,
      ...(query.direction ? { direction: query.direction as DebtDirection } : {}),
      ...(query.status ? { status: query.status as DebtStatus } : {}),
    };

    if (query.overdue === true) {
      where.status = { not: 'PAID' };
      where.dueDate = { lt: today, not: null };
    } else if (query.overdue === false) {
      where.OR = [
        { status: 'PAID' },
        { dueDate: null },
        { dueDate: { gte: today } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [debts, total] = await Promise.all([
      this.prisma.debt.findMany({
        where,
        include: {
          payments: {
            orderBy: { paidAt: 'desc' },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.debt.count({ where }),
    ]);

    return { debts, total };
  }

  async calculateSummary(userId: string): Promise<{
    owedToMe: bigint;
    iOwe: bigint;
    net: bigint;
    overdueCount: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const debts = await this.prisma.debt.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { not: 'PAID' },
      },
      include: {
        payments: {
          select: { amount: true },
        },
      },
    });

    let owedToMe = 0n;
    let iOwe = 0n;
    let overdueCount = 0;

    for (const debt of debts) {
      const paid = debt.payments.reduce((acc, p) => acc + p.amount, 0n);
      const remaining = debt.amount > paid ? debt.amount - paid : 0n;

      if (debt.direction === 'I_LENT') {
        owedToMe += remaining;
      } else {
        iOwe += remaining;
      }

      if (debt.dueDate && debt.dueDate < today) {
        overdueCount++;
      }
    }

    return {
      owedToMe,
      iOwe,
      net: owedToMe - iOwe,
      overdueCount,
    };
  }

  async findById(userId: string, id: string): Promise<DebtWithPayments | null> {
    return this.prisma.debt.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });
  }

  async createDebt(
    userId: string,
    data: CreateDebtRepoData,
  ): Promise<{ debt: DebtWithPayments; transaction: Transaction }> {
    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.create({
        data: {
          userId,
          direction: data.direction,
          personName: data.personName,
          personPhone: data.personPhone,
          amount: data.amount,
          dueDate: data.dueDate,
          note: data.note,
          status: 'ACTIVE',
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: data.accountId,
          type: data.direction === 'I_LENT' ? 'LOAN_GIVEN' : 'LOAN_TAKEN',
          amount: data.amount,
          debtId: debt.id,
          date: new Date(),
          note: data.note,
        },
      });

      return {
        debt: { ...debt, payments: [] },
        transaction,
      };
    });
  }

  async update(userId: string, id: string, data: UpdateDebtRepoData): Promise<DebtWithPayments> {
    return this.prisma.debt.update({
      where: { id },
      data,
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });
  }

  async createPayment(
    userId: string,
    debtId: string,
    data: CreatePaymentRepoData,
    newStatus: DebtStatus,
    newPaidAt: Date | null,
  ): Promise<{ payment: DebtPayment; updatedDebt: DebtWithPayments; transaction: Transaction }> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: data.accountId,
          type: data.type,
          amount: data.amount,
          debtId,
          date: data.paidAt,
          note: data.note,
        },
      });

      const payment = await tx.debtPayment.create({
        data: {
          debtId,
          transactionId: transaction.id,
          amount: data.amount,
          paidAt: data.paidAt,
          note: data.note,
        },
      });

      const updatedDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          status: newStatus,
          paidAt: newPaidAt,
        },
        include: {
          payments: {
            orderBy: { paidAt: 'desc' },
          },
        },
      });

      return {
        payment,
        updatedDebt,
        transaction,
      };
    });
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.debt.update({
        where: { id },
        data: { deletedAt: now },
      });

      await tx.transaction.updateMany({
        where: {
          debtId: id,
          userId,
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
    });
  }

  async findPayments(userId: string, debtId: string): Promise<DebtPayment[]> {
    return this.prisma.debtPayment.findMany({
      where: {
        debtId,
        debt: {
          userId,
          deletedAt: null,
        },
      },
      orderBy: { paidAt: 'desc' },
    });
  }
}
