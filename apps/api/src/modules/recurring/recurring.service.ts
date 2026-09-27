import { HttpStatus, Injectable } from '@nestjs/common';
import { RecurrenceFrequency, TransactionType } from '@prisma/client';
import {
  CreateRecurringRuleInput,
  RecurringRuleResponse,
  TransactionResponse,
  UpdateRecurringRuleInput,
  formatIsoDate,
  parseIsoDate,
} from '@fintrack/shared';
import {
  OccurrenceWithRelations,
  RecurringRepository,
  RecurringRuleWithRelations,
} from './recurring.repository';
import { RecurringRunnerService } from './recurring-runner.service';
import { defaultDayOfCycle, firstOccurrenceOnOrAfter } from './recurrence';
import { AccountAccessService } from '../accounts/account-access.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ClockService } from '../../infra/clock/clock.service';
import {
  ConflictDomainException,
  DomainException,
  InvalidCategoryTypeException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';

function laterOf(a: Date, b: Date): Date {
  return a > b ? a : b;
}

@Injectable()
export class RecurringService {
  constructor(
    private readonly repository: RecurringRepository,
    private readonly runner: RecurringRunnerService,
    private readonly accountAccess: AccountAccessService,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly balanceGuard: BalanceGuardService,
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
  ) {}

  async list(userId: string, isActive?: boolean): Promise<RecurringRuleResponse[]> {
    const rules = await this.repository.findMany(userId, isActive);
    return rules.map((r) => this.mapRule(r));
  }

  async getById(userId: string, id: string): Promise<RecurringRuleResponse> {
    return this.mapRule(await this.requireRule(userId, id));
  }

  /** Past occurrences are not back-filled: the schedule starts at max(startsAt, today). */
  async create(userId: string, dto: CreateRecurringRuleInput): Promise<RecurringRuleResponse> {
    await this.accountAccess.assertWritable(userId, dto.accountId);
    if (dto.categoryId) await this.assertCategory(userId, dto.categoryId, dto.type);

    const frequency = dto.frequency as RecurrenceFrequency;
    const startsAt = parseIsoDate(dto.startsAt);
    const dayOfCycle = defaultDayOfCycle(frequency, startsAt, dto.dayOfCycle);
    const today = parseIsoDate(await this.clock.todayFor(userId));

    const created = await this.repository.create(userId, {
      accountId: dto.accountId,
      categoryId: dto.categoryId ?? null,
      type: dto.type as TransactionType,
      amount: BigInt(dto.amount),
      frequency,
      dayOfCycle,
      startsAt,
      endsAt: dto.endsAt ? parseIsoDate(dto.endsAt) : null,
      nextRunAt: firstOccurrenceOnOrAfter(laterOf(startsAt, today), frequency, startsAt, dayOfCycle),
      note: dto.note ?? null,
    });

    // A rule that is due today should not wait for the next hourly run.
    await this.runner.materialize(created.id);
    return this.getById(userId, created.id);
  }

  async update(userId: string, id: string, dto: UpdateRecurringRuleInput): Promise<RecurringRuleResponse> {
    const existing = await this.requireRule(userId, id);
    const endsAt = dto.endsAt === undefined ? undefined : dto.endsAt ? parseIsoDate(dto.endsAt) : null;
    if (endsAt && endsAt < existing.startsAt) {
      throw new DomainException(
        'Tugash sanasi boshlanish sanasidan oldin bo‘lishi mumkin emas',
        'VALIDATION_ERROR',
        HttpStatus.BAD_REQUEST,
      );
    }

    const dayOfCycle =
      dto.dayOfCycle === undefined
        ? undefined
        : defaultDayOfCycle(existing.frequency, existing.startsAt, dto.dayOfCycle);

    // Re-activating or re-anchoring restarts the schedule from today instead of replaying the gap.
    const reschedule = (dto.isActive === true && !existing.isActive) || dayOfCycle !== undefined;
    let nextRunAt: Date | undefined;
    if (reschedule) {
      const today = parseIsoDate(await this.clock.todayFor(userId));
      nextRunAt = firstOccurrenceOnOrAfter(
        laterOf(existing.startsAt, today),
        existing.frequency,
        existing.startsAt,
        dayOfCycle === undefined ? existing.dayOfCycle : dayOfCycle,
      );
    }

    const updated = await this.repository.update(userId, id, {
      amount: dto.amount ? BigInt(dto.amount) : undefined,
      note: dto.note,
      isActive: dto.isActive,
      dayOfCycle,
      endsAt,
      nextRunAt,
    });
    return this.mapRule(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.requireRule(userId, id);
    await this.repository.delete(userId, id);
  }

  /**
   * Books today's occurrence immediately. Repeating it the same day returns the same row;
   * an occurrence the user already deleted today is not silently recreated.
   */
  async runNow(
    userId: string,
    id: string,
  ): Promise<{ transaction: TransactionResponse; rule: RecurringRuleResponse }> {
    const existing = await this.requireRule(userId, id);
    if (!existing.isActive) {
      throw new DomainException(
        'Nofaol takroriy to‘lovni ishga tushirib bo‘lmaydi',
        'RECURRING_INACTIVE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.accountAccess.assertWritable(userId, existing.accountId);
    const todayIso = await this.clock.todayFor(userId);
    const today = parseIsoDate(todayIso);

    const result = await this.prisma.$transaction(async (db) => {
      const rule = await this.repository.lock(db, id, userId);
      if (!rule) throw new NotFoundDomainException('Takroriy to‘lov qoidasi topilmadi');

      const live = await this.repository.findLiveOccurrence(db, rule.id, today);
      if (live) return { transaction: live, rule: existing, created: false };
      if (await this.repository.findOccurrence(db, rule.id, today)) {
        throw new ConflictDomainException(
          'RECURRING_ALREADY_RAN',
          'Bugungi to‘lov allaqachon yozilgan va o‘chirilgan',
          { date: todayIso },
        );
      }

      if (rule.type === 'EXPENSE') {
        await this.balanceGuard.assertCanDebit(db, userId, rule.accountId, rule.amount);
      }
      const transaction = await this.repository.createOccurrence(db, rule, today);

      // Today's scheduled occurrence has now been paid; the schedule moves past it.
      const nextRunAt =
        rule.nextRunAt <= today
          ? firstOccurrenceOnOrAfter(
              new Date(today.getTime() + 86_400_000),
              rule.frequency,
              rule.startsAt,
              rule.dayOfCycle,
            )
          : rule.nextRunAt;
      const saved = await this.repository.saveSchedule(db, rule.id, nextRunAt, rule.isActive);
      return { transaction, rule: saved, created: true };
    });

    if (result.created) {
      await this.runner.afterCommit({
        rule: result.rule,
        created: [result.transaction],
        skippedDates: [],
        deactivatedReason: null,
      });
    }
    return { transaction: this.mapTransaction(result.transaction), rule: this.mapRule(result.rule) };
  }

  private async requireRule(userId: string, id: string): Promise<RecurringRuleWithRelations> {
    const rule = await this.repository.findById(userId, id);
    if (!rule) throw new NotFoundDomainException('Takroriy to‘lov qoidasi topilmadi');
    return rule;
  }

  private async assertCategory(userId: string, categoryId: string, type: string): Promise<void> {
    const category = await this.categoriesRepository.findById(userId, categoryId);
    if (!category) throw new NotFoundDomainException('Kategoriya topilmadi');
    if (category.type !== type) throw new InvalidCategoryTypeException();
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

  private mapTransaction(tx: OccurrenceWithRelations): TransactionResponse {
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toString(),
      date: formatIsoDate(tx.date),
      note: tx.note,
      account: tx.account,
      category: tx.category,
      tags: tx.tags.map((t) => t.tag),
      debtId: tx.debtId,
      transferGroupId: tx.transferGroupId,
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
