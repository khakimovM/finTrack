import { Injectable } from '@nestjs/common';
import {
  Debt,
  DebtDirection,
  DebtPayment,
  DebtStatus,
  Prisma,
  Transaction,
  TransactionType,
} from '@prisma/client';
import { ListDebtsQuery } from '@fintrack/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';
import { toBigInt } from '../../infra/prisma/ledger-sql';

export type DebtWithPayments = Debt & { payments: DebtPayment[] };
export type DebtPaymentWithTransaction = DebtPayment & { transaction: Transaction };

export interface CreateDebtRepoData {
  direction: DebtDirection;
  personName: string;
  personPhone?: string | null;
  accountId: string;
  amount: bigint;
  date: Date;
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

export interface DebtSummaryRow {
  owedToMe: bigint;
  iOwe: bigint;
  net: bigint;
  overdueCount: number;
  overdueAmount: bigint;
}

const paymentsInclude = { payments: { orderBy: { paidAt: 'desc' } } } satisfies Prisma.DebtInclude;

@Injectable()
export class DebtsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    userId: string,
    query: ListDebtsQuery,
    today: Date,
  ): Promise<{ debts: DebtWithPayments[]; total: number }> {
    const where: Prisma.DebtWhereInput = {
      userId,
      deletedAt: null,
      ...(query.direction ? { direction: query.direction as DebtDirection } : {}),
      ...(query.status ? { status: query.status as DebtStatus } : {}),
    };

    if (query.overdue === true) {
      where.AND = [{ status: { not: 'PAID' } }, { dueDate: { lt: today } }];
    } else if (query.overdue === false) {
      where.OR = [{ status: 'PAID' }, { dueDate: null }, { dueDate: { gte: today } }];
    }

    const [debts, total] = await Promise.all([
      this.prisma.debt.findMany({
        where,
        include: paymentsInclude,
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.debt.count({ where }),
    ]);
    return { debts, total };
  }

  /** Outstanding balances aggregated in SQL (remaining = amount − payments, never stored). */
  async summary(userId: string, today: Date): Promise<DebtSummaryRow> {
    const rows = await this.prisma.$queryRaw<
      Array<{ direction: DebtDirection; remaining: unknown; overdueCount: unknown; overdueAmount: unknown }>
    >`
      SELECT d.direction,
             COALESCE(SUM(d.amount - COALESCE(p.paid, 0)), 0) AS remaining,
             COUNT(*) FILTER (WHERE d.due_date < ${today}) AS "overdueCount",
             COALESCE(SUM(d.amount - COALESCE(p.paid, 0)) FILTER (WHERE d.due_date < ${today}), 0) AS "overdueAmount"
      FROM debts d
      LEFT JOIN LATERAL (
        SELECT SUM(dp.amount) AS paid FROM debt_payments dp WHERE dp.debt_id = d.id
      ) p ON TRUE
      WHERE d.user_id = ${userId} AND d.deleted_at IS NULL AND d.status <> 'PAID'
      GROUP BY d.direction
    `;

    const pick = (direction: DebtDirection) => rows.find((r) => r.direction === direction);
    const owedToMe = toBigInt(pick('I_LENT')?.remaining);
    const iOwe = toBigInt(pick('I_BORROWED')?.remaining);
    return {
      owedToMe,
      iOwe,
      net: owedToMe - iOwe,
      overdueCount: rows.reduce((n, r) => n + Number(toBigInt(r.overdueCount)), 0),
      overdueAmount: rows.reduce((n, r) => n + toBigInt(r.overdueAmount), 0n),
    };
  }

  async countByStatus(userId: string): Promise<Record<DebtStatus, number>> {
    const groups = await this.prisma.debt.groupBy({
      by: ['status'],
      where: { userId, deletedAt: null },
      _count: { _all: true },
    });
    const counts: Record<DebtStatus, number> = { ACTIVE: 0, PARTIALLY_PAID: 0, PAID: 0 };
    for (const g of groups) counts[g.status] = g._count._all;
    return counts;
  }

  async findById(userId: string, id: string, db: Db = this.prisma): Promise<DebtWithPayments | null> {
    return db.debt.findFirst({ where: { id, userId, deletedAt: null }, include: paymentsInclude });
  }

  /** Row lock serialising every payment on this debt until the surrounding transaction ends. */
  async lock(db: Db, userId: string, id: string): Promise<Debt | null> {
    const locked = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM debts WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL FOR UPDATE
    `;
    if (locked.length === 0) return null;
    return db.debt.findUnique({ where: { id } });
  }

  async paidAmount(db: Db, debtId: string): Promise<bigint> {
    const result = await db.debtPayment.aggregate({ where: { debtId }, _sum: { amount: true } });
    return result._sum.amount ?? 0n;
  }

  async createDebt(
    db: Db,
    userId: string,
    data: CreateDebtRepoData,
  ): Promise<{ debt: DebtWithPayments; transaction: Transaction }> {
    const debt = await db.debt.create({
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

    const transaction = await db.transaction.create({
      data: {
        userId,
        accountId: data.accountId,
        type: data.direction === 'I_LENT' ? 'LOAN_GIVEN' : 'LOAN_TAKEN',
        amount: data.amount,
        debtId: debt.id,
        date: data.date,
        note: data.note ?? `Qarz: ${data.personName}`,
      },
    });

    return { debt: { ...debt, payments: [] }, transaction };
  }

  async update(userId: string, id: string, data: UpdateDebtRepoData): Promise<DebtWithPayments> {
    return this.prisma.debt.update({
      where: { id, userId, deletedAt: null },
      data,
      include: paymentsInclude,
    });
  }

  async createPayment(
    db: Db,
    userId: string,
    debtId: string,
    data: CreatePaymentRepoData,
  ): Promise<{ payment: DebtPayment; transaction: Transaction }> {
    const transaction = await db.transaction.create({
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
    const payment = await db.debtPayment.create({
      data: {
        debtId,
        transactionId: transaction.id,
        amount: data.amount,
        paidAt: data.paidAt,
        note: data.note,
      },
    });
    return { payment, transaction };
  }

  async setStatus(
    db: Db,
    userId: string,
    debtId: string,
    status: DebtStatus,
    paidAt: Date | null,
  ): Promise<DebtWithPayments> {
    return db.debt.update({
      where: { id: debtId, userId },
      data: { status, paidAt },
      include: paymentsInclude,
    });
  }

  async findPayment(
    db: Db,
    userId: string,
    debtId: string,
    paymentId: string,
  ): Promise<DebtPaymentWithTransaction | null> {
    return db.debtPayment.findFirst({
      where: { id: paymentId, debtId, debt: { userId, deletedAt: null } },
      include: { transaction: true },
    });
  }

  /** The ledger row is soft-deleted (history kept); the payment row itself goes away. */
  async deletePayment(db: Db, userId: string, payment: DebtPaymentWithTransaction): Promise<void> {
    await db.debtPayment.delete({ where: { id: payment.id } });
    await db.transaction.update({
      where: { id: payment.transactionId, userId },
      data: { deletedAt: new Date() },
    });
  }

  async liveLedgerRows(db: Db, userId: string, debtId: string): Promise<Transaction[]> {
    return db.transaction.findMany({ where: { userId, debtId, deletedAt: null } });
  }

  async softDelete(db: Db, userId: string, id: string): Promise<void> {
    const now = new Date();
    await db.debt.update({ where: { id, userId }, data: { deletedAt: now } });
    await db.transaction.updateMany({
      where: { debtId: id, userId, deletedAt: null },
      data: { deletedAt: now },
    });
  }

  async findPayments(userId: string, debtId: string): Promise<DebtPayment[]> {
    return this.prisma.debtPayment.findMany({
      where: { debtId, debt: { userId, deletedAt: null } },
      orderBy: { paidAt: 'desc' },
    });
  }
}
