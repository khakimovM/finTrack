import { Injectable, Logger } from '@nestjs/common';
import { RecurrenceFrequency, TransactionType } from '@prisma/client';
import {
  CreateRecurringRuleInput,
  UpdateRecurringRuleInput,
  RecurringRuleResponse,
  TransactionResponse,
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  formatIsoDate,
  parseIsoDate,
} from '@fintrack/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  RecurringRepository,
  RecurringRuleWithRelations,
} from './recurring.repository';
import { AccountsRepository } from '../accounts/accounts.repository';
import { CategoriesRepository } from '../categories/categories.repository';
import { BalanceService } from '../accounts/balance.service';
import { BudgetsService } from '../budgets/budgets.service';
import {
  NotFoundDomainException,
  InvalidCategoryTypeException,
} from '../../common/exceptions/domain.exception';

export function computeNextRun(
  current: Date,
  frequency: RecurrenceFrequency,
  dayOfCycle?: number | null,
): Date {
  switch (frequency) {
    case 'DAILY':
      return addDays(current, 1);
    case 'WEEKLY':
      return addDays(current, 7);
    case 'MONTHLY': {
      const nextMonth = addMonths(current, 1);
      if (dayOfCycle && dayOfCycle >= 1 && dayOfCycle <= 31) {
        const maxDays = endOfMonth(nextMonth).getUTCDate();
        const targetDay = Math.min(dayOfCycle, maxDays);
        return new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), targetDay));
      }
      return nextMonth;
    }
    case 'YEARLY':
      return addYears(current, 1);
  }
}

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly repository: RecurringRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly balanceService: BalanceService,
    private readonly budgetsService: BudgetsService,
    private readonly prisma: PrismaService,
  ) {}

  async list(userId: string, isActive?: boolean): Promise<RecurringRuleResponse[]> {
    const rules = await this.repository.findMany(userId, isActive);
    return rules.map((r) => this.mapRule(r));
  }

  async getById(userId: string, id: string): Promise<RecurringRuleResponse> {
    const rule = await this.repository.findById(userId, id);
    if (!rule) {
      throw new NotFoundDomainException('Takroriy to‘lov qoidasi topilmadi');
    }
    return this.mapRule(rule);
  }

  async create(userId: string, dto: CreateRecurringRuleInput): Promise<RecurringRuleResponse> {
    const account = await this.accountsRepository.findById(userId, dto.accountId);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    if (dto.categoryId) {
      const category = await this.categoriesRepository.findById(userId, dto.categoryId);
      if (!category) {
        throw new NotFoundDomainException('Kategoriya topilmadi');
      }
      if (category.type !== dto.type) {
        throw new InvalidCategoryTypeException();
      }
    }

    const startsAt = parseIsoDate(dto.startsAt);
    const endsAt = dto.endsAt ? parseIsoDate(dto.endsAt) : null;
    const nextRunAt = startsAt;

    const created = await this.repository.create(userId, {
      accountId: dto.accountId,
      categoryId: dto.categoryId ?? null,
      type: dto.type as TransactionType,
      amount: BigInt(dto.amount),
      frequency: dto.frequency as RecurrenceFrequency,
      dayOfCycle: dto.dayOfCycle ?? null,
      startsAt,
      endsAt,
      nextRunAt,
      note: dto.note ?? null,
    });

    return this.mapRule(created);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringRuleInput,
  ): Promise<RecurringRuleResponse> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new NotFoundDomainException('Takroriy to‘lov qoidasi topilmadi');
    }

    const updated = await this.repository.update(userId, id, {
      amount: dto.amount ? BigInt(dto.amount) : undefined,
      note: dto.note,
      isActive: dto.isActive,
      dayOfCycle: dto.dayOfCycle,
      endsAt: dto.endsAt ? parseIsoDate(dto.endsAt) : undefined,
    });

    return this.mapRule(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new NotFoundDomainException('Takroriy to‘lov qoidasi topilmadi');
    }
    await this.repository.delete(userId, id);
  }

  async runNow(
    userId: string,
    id: string,
  ): Promise<{ transaction: TransactionResponse; rule: RecurringRuleResponse }> {
    const rule = await this.repository.findById(userId, id);
    if (!rule) {
      throw new NotFoundDomainException('Takroriy to‘lov qoidasi topilmadi');
    }

    const todayStr = formatIsoDate(new Date());
    const today = parseIsoDate(todayStr);

    let tx = await this.prisma.transaction.findFirst({
      where: {
        recurringRuleId: rule.id,
        date: today,
        deletedAt: null,
      },
      include: {
        account: { select: { id: true, name: true, icon: true } },
        category: { select: { id: true, name: true, icon: true, color: true } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    let updatedRule = rule;

    if (!tx) {
      const result = await this.prisma.$transaction(async (prismaTx) => {
        const createdTx = await prismaTx.transaction.create({
          data: {
            userId: rule.userId,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            type: rule.type,
            amount: rule.amount,
            date: today,
            note: rule.note ?? 'Takroriy to‘lov',
            recurringRuleId: rule.id,
          },
          include: {
            account: { select: { id: true, name: true, icon: true } },
            category: { select: { id: true, name: true, icon: true, color: true } },
            tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
          },
        });

        let nextRun = rule.nextRunAt;
        if (nextRun <= today) {
          nextRun = computeNextRun(today, rule.frequency, rule.dayOfCycle);
        }
        const isDeactivated = rule.endsAt ? nextRun > rule.endsAt : false;

        const updated = await prismaTx.recurringRule.update({
          where: { id: rule.id },
          data: {
            nextRunAt: nextRun,
            isActive: isDeactivated ? false : rule.isActive,
          },
          include: {
            account: { select: { id: true, name: true, icon: true } },
            category: { select: { id: true, name: true, icon: true, color: true } },
          },
        });

        return { createdTx, updated };
      });

      tx = result.createdTx;
      updatedRule = result.updated;

      await this.balanceService.invalidate(userId);

      if (rule.type === 'EXPENSE' && rule.categoryId) {
        await this.budgetsService.checkAndNotify(userId, rule.categoryId, today).catch(() => {});
      }
    }

    return {
      transaction: this.mapTransaction(tx),
      rule: this.mapRule(updatedRule),
    };
  }

  async processDueRules(
    targetDate?: Date,
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    const effectiveDate = targetDate ?? parseIsoDate(formatIsoDate(new Date()));
    const dueRules = await this.repository.findDueRules(effectiveDate);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const rule of dueRules) {
      try {
        const existing = await this.repository.findExistingTransaction(rule.id, rule.nextRunAt);
        if (existing) {
          const nextRun = computeNextRun(rule.nextRunAt, rule.frequency, rule.dayOfCycle);
          const isDeactivated = rule.endsAt ? nextRun > rule.endsAt : false;
          await this.repository.update(rule.userId, rule.id, {
            nextRunAt: nextRun,
            isActive: isDeactivated ? false : undefined,
          });
          skipped++;
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              userId: rule.userId,
              accountId: rule.accountId,
              categoryId: rule.categoryId,
              type: rule.type,
              amount: rule.amount,
              date: rule.nextRunAt,
              note: rule.note ?? 'Takroriy to‘lov',
              recurringRuleId: rule.id,
            },
          });

          const nextRun = computeNextRun(rule.nextRunAt, rule.frequency, rule.dayOfCycle);
          const isDeactivated = rule.endsAt ? nextRun > rule.endsAt : false;

          await tx.recurringRule.update({
            where: { id: rule.id },
            data: {
              nextRunAt: nextRun,
              isActive: isDeactivated ? false : undefined,
            },
          });
        });

        await this.balanceService.invalidate(rule.userId);

        if (rule.type === 'EXPENSE' && rule.categoryId) {
          await this.budgetsService
            .checkAndNotify(rule.userId, rule.categoryId, rule.nextRunAt)
            .catch(() => {});
        }

        processed++;
      } catch (err: unknown) {
        const errorObject = err as { code?: string; message?: string };
        if (errorObject?.code === 'P2002') {
          skipped++;
        } else {
          this.logger.error(`Error processing recurring rule ${rule.id}: ${errorObject?.message}`);
          errors++;
        }
      }
    }

    return { processed, skipped, errors };
  }

  private mapRule(rule: RecurringRuleWithRelations): RecurringRuleResponse {
    return {
      id: rule.id,
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      type: rule.type as 'INCOME' | 'EXPENSE',
      amount: rule.amount.toString(),
      frequency: rule.frequency,
      dayOfCycle: rule.dayOfCycle,
      startsAt: formatIsoDate(rule.startsAt),
      endsAt: rule.endsAt ? formatIsoDate(rule.endsAt) : null,
      nextRunAt: formatIsoDate(rule.nextRunAt),
      isActive: rule.isActive,
      account: rule.account,
      category: rule.category,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  private mapTransaction(tx: {
    id: string;
    type: TransactionType;
    amount: bigint;
    date: Date;
    note: string | null;
    account: { id: string; name: string; icon: string };
    category: { id: string; name: string; icon: string; color: string } | null;
    tags: Array<{ tag: { id: string; name: string; color: string } }>;
    debtId?: string | null;
    transferGroupId?: string | null;
    createdAt: Date;
  }): TransactionResponse {
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      date: formatIsoDate(tx.date),
      note: tx.note,
      account: tx.account,
      category: tx.category,
      tags: tx.tags.map((t) => t.tag),
      debtId: tx.debtId ?? null,
      transferGroupId: tx.transferGroupId ?? null,
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
