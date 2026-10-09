import { Injectable } from '@nestjs/common';
import { DebtDirection, TransactionSource, TransactionType } from '@prisma/client';
import {
  DebtResponse,
  DebtListMeta,
  CreateDebtInput,
  UpdateDebtInput,
  ListDebtsQuery,
  parseIsoDate,
} from '@fintrack/shared';
import { DebtsRepository } from './debts.repository';
import { toDebtResponse } from './debt.mapper';
import { AccountAccessService } from '../accounts/account-access.service';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import { balanceDeltas } from '../accounts/ledger-effect';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ClockService } from '../../infra/clock/clock.service';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';

export interface CreateDebtResult {
  debt: DebtResponse;
  transaction: { id: string; type: TransactionType; amount: string };
  totalBalance: string;
}

@Injectable()
export class DebtsService {
  constructor(
    private readonly repository: DebtsRepository,
    private readonly accountAccess: AccountAccessService,
    private readonly balanceService: BalanceService,
    private readonly balanceGuard: BalanceGuardService,
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
  ) {}

  async list(userId: string, query: ListDebtsQuery): Promise<{ data: DebtResponse[]; meta: DebtListMeta }> {
    const today = await this.clock.todayFor(userId);
    const todayDate = parseIsoDate(today);
    const [{ debts, total }, summary] = await Promise.all([
      this.repository.findMany(userId, query, todayDate),
      this.repository.summary(userId, todayDate),
    ]);

    return {
      data: debts.map((d) => toDebtResponse(d, today)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
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
    if (!debt) throw new NotFoundDomainException('Qarz topilmadi');
    return toDebtResponse(debt, await this.clock.todayFor(userId));
  }

  /** Debt + its LOAN_GIVEN/LOAN_TAKEN ledger row are written in one transaction. */
  async create(userId: string, dto: CreateDebtInput, source: TransactionSource): Promise<CreateDebtResult> {
    const today = await this.clock.todayFor(userId);
    const date = dto.date ?? today;
    await this.clock.assertNotFuture(userId, date);
    await this.accountAccess.assertWritable(userId, dto.accountId);

    const amount = BigInt(dto.amount);
    const direction = dto.direction as DebtDirection;

    const { debt, transaction } = await this.prisma.$transaction(async (db) => {
      if (direction === 'I_LENT') {
        await this.balanceGuard.assertCanDebit(db, userId, dto.accountId, amount);
      }
      return this.repository.createDebt(db, userId, {
        direction,
        personName: dto.personName,
        personPhone: dto.personPhone,
        accountId: dto.accountId,
        amount,
        date: parseIsoDate(date),
        dueDate: dto.dueDate ? parseIsoDate(dto.dueDate) : null,
        note: dto.note,
        source,
      });
    });

    await this.balanceService.invalidate(userId, [dto.accountId]);
    const totalBalance = await this.balanceService.getTotalBalance(userId);

    return {
      debt: toDebtResponse(debt, today),
      transaction: { id: transaction.id, type: transaction.type, amount: transaction.amount.toString() },
      totalBalance: totalBalance.toString(),
    };
  }

  async update(userId: string, id: string, dto: UpdateDebtInput): Promise<DebtResponse> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) throw new NotFoundDomainException('Qarz topilmadi');

    const updated = await this.repository.update(userId, id, {
      personName: dto.personName,
      personPhone: dto.personPhone,
      dueDate: dto.dueDate !== undefined ? (dto.dueDate ? parseIsoDate(dto.dueDate) : null) : undefined,
      note: dto.note,
    });
    return toDebtResponse(updated, await this.clock.todayFor(userId));
  }

  /** Removing a debt reverses all of its ledger rows so balances heal themselves. */
  async delete(userId: string, id: string): Promise<void> {
    const touched = await this.prisma.$transaction(async (db) => {
      const debt = await this.repository.lock(db, userId, id);
      if (!debt) throw new NotFoundDomainException('Qarz topilmadi');

      const rows = await this.repository.liveLedgerRows(db, userId, id);
      await this.balanceGuard.assertDeltas(db, userId, balanceDeltas(rows, []));
      await this.repository.softDelete(db, userId, id);
      return rows.map((row) => row.accountId);
    });
    await this.balanceService.invalidate(userId, touched);
  }
}
