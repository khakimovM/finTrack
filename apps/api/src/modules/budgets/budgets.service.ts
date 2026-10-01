import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BudgetResponse,
  BudgetStatusItem,
  BudgetStatusResponse,
  CreateBudgetInput,
  UpdateBudgetInput,
  endOfMonth,
  formatIsoDate,
  parseIsoDate,
  startOfMonth,
} from '@fintrack/shared';
import { BudgetsRepository, BudgetWithCategory } from './budgets.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { ClockService } from '../../infra/clock/clock.service';
import {
  ConflictDomainException,
  InvalidCategoryTypeException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';

export interface BudgetAlert {
  categoryId: string;
  percent: number;
  limit: string;
  spent: string;
}

const WARNING_THRESHOLD = 80;
const EXCEEDED_THRESHOLD = 100;

/** Percentage with one decimal, computed in BigInt (money never goes through floats). */
export function percentOf(spent: bigint, limit: bigint): number {
  if (limit <= 0n) return 0;
  return Number((spent * 1000n) / limit) / 10;
}

function thresholdReached(percent: number): number {
  if (percent >= EXCEEDED_THRESHOLD) return EXCEEDED_THRESHOLD;
  if (percent >= WARNING_THRESHOLD) return WARNING_THRESHOLD;
  return 0;
}

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private readonly repository: BudgetsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly clock: ClockService,
  ) {}

  async list(userId: string, monthStr?: string): Promise<BudgetResponse[]> {
    const month = await this.resolveMonth(userId, monthStr);
    const items = await this.repository.findManyByMonth(userId, month);
    return items.map((b) => this.mapToResponse(b));
  }

  async getStatus(userId: string, monthStr?: string): Promise<BudgetStatusResponse> {
    const month = await this.resolveMonth(userId, monthStr);
    const [budgets, spentByCategory] = await Promise.all([
      this.repository.findManyByMonth(userId, month),
      this.spentByCategory(userId, month),
    ]);

    let totalLimit = 0n;
    let totalSpent = 0n;
    const data: BudgetStatusItem[] = budgets.map((b) => {
      const spent = spentByCategory.get(b.categoryId) ?? 0n;
      totalLimit += b.limitAmount;
      totalSpent += spent;
      const percent = percentOf(spent, b.limitAmount);
      return {
        id: b.id,
        category: { id: b.category.id, name: b.category.name, icon: b.category.icon, color: b.category.color },
        limitAmount: b.limitAmount.toString(),
        spent: spent.toString(),
        remaining: (b.limitAmount > spent ? b.limitAmount - spent : 0n).toString(),
        percent,
        state: percent > 100 ? 'EXCEEDED' : percent >= WARNING_THRESHOLD ? 'WARNING' : 'OK',
      };
    });

    return {
      data,
      meta: {
        month: formatIsoDate(month).slice(0, 7),
        totalLimit: totalLimit.toString(),
        totalSpent: totalSpent.toString(),
      },
    };
  }

  async create(userId: string, dto: CreateBudgetInput): Promise<BudgetResponse> {
    const category = await this.categoriesRepository.findById(userId, dto.categoryId);
    if (!category) throw new NotFoundDomainException('Kategoriya topilmadi');
    if (category.type !== 'EXPENSE') {
      throw new InvalidCategoryTypeException('Byudjet faqat xarajat kategoriyasi uchun belgilanadi');
    }

    const month = await this.resolveMonth(userId, dto.month);
    try {
      const created = await this.repository.create(userId, {
        categoryId: dto.categoryId,
        month,
        limitAmount: BigInt(dto.limitAmount),
      });
      return this.mapToResponse(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictDomainException(
          'BUDGET_EXISTS',
          'Ushbu oy uchun ushbu kategoriyada byudjet allaqachon mavjud',
        );
      }
      throw err;
    }
  }

  /** Re-arms alerts: after raising a limit the user is told again when they cross 80%/100%. */
  async update(userId: string, id: string, dto: UpdateBudgetInput): Promise<BudgetResponse> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) throw new NotFoundDomainException('Byudjet topilmadi');

    const limitAmount = BigInt(dto.limitAmount);
    const spent = (await this.spentByCategory(userId, existing.month)).get(existing.categoryId) ?? 0n;
    const updated = await this.repository.update(userId, id, {
      limitAmount,
      notifiedAt: thresholdReached(percentOf(spent, limitAmount)),
    });
    return this.mapToResponse(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) throw new NotFoundDomainException('Byudjet topilmadi');
    await this.repository.delete(userId, id);
  }

  /**
   * Called after an EXPENSE lands in `categoryId`. Checks that category's budget and its
   * parent's (a parent budget covers subcategories). Never throws: a budget must not block
   * or fail a transaction (40-domain-money.md §6).
   */
  async checkAndNotify(userId: string, categoryId: string, txDate: Date): Promise<BudgetAlert | null> {
    try {
      const category = await this.categoriesRepository.findById(userId, categoryId);
      if (!category) return null;

      const month = startOfMonth(txDate);
      const candidates = [categoryId, ...(category.parentId ? [category.parentId] : [])];
      const spentByCategory = await this.spentByCategory(userId, month);

      let alert: BudgetAlert | null = null;
      for (const candidateId of candidates) {
        const budget = await this.repository.findByCategoryAndMonth(userId, candidateId, month);
        if (!budget) continue;

        const spent = spentByCategory.get(candidateId) ?? 0n;
        const percent = percentOf(spent, budget.limitAmount);
        await this.announceThreshold(userId, budget, percent);

        if (!alert && percent >= WARNING_THRESHOLD) {
          alert = {
            categoryId: budget.categoryId,
            percent,
            limit: budget.limitAmount.toString(),
            spent: spent.toString(),
          };
        }
      }
      return alert;
    } catch (err) {
      this.logger.error('Budget check failed (transaction was not affected)', err);
      return null;
    }
  }

  private async announceThreshold(userId: string, budget: BudgetWithCategory, percent: number): Promise<void> {
    const threshold = thresholdReached(percent);
    if (threshold === 0) return;
    if (!(await this.repository.claimThreshold(userId, budget.id, threshold))) return;

    const exceeded = threshold === EXCEEDED_THRESHOLD;
    await this.notificationsService.createSafe(userId, {
      type: exceeded ? 'BUDGET_EXCEEDED' : 'BUDGET_WARNING',
      title: exceeded ? 'Byudjet chegarasi oshib ketdi' : 'Byudjet chegarasi ogohlantirishi',
      body: exceeded
        ? `"${budget.category.name}" byudjeti ${percent}% ga yetdi va limitdan oshdi.`
        : `"${budget.category.name}" byudjetining ${percent}% qismi sarflandi.`,
      meta: { budgetId: budget.id, categoryId: budget.categoryId, percent },
    });
  }

  /** Spent per category for the month, with each subcategory also counted in its parent. */
  private async spentByCategory(userId: string, month: Date): Promise<Map<string, bigint>> {
    const rows = await this.repository.expenseByCategory(userId, month, endOfMonth(month));
    const totals = new Map<string, bigint>();
    const add = (id: string, amount: bigint) => totals.set(id, (totals.get(id) ?? 0n) + amount);
    for (const row of rows) {
      add(row.categoryId, row.spent);
      if (row.parentId) add(row.parentId, row.spent);
    }
    return totals;
  }

  private async resolveMonth(userId: string, monthStr?: string): Promise<Date> {
    const iso = monthStr ?? (await this.clock.todayFor(userId));
    return startOfMonth(parseIsoDate(iso.length === 7 ? `${iso}-01` : iso));
  }

  private mapToResponse(b: BudgetWithCategory): BudgetResponse {
    return {
      id: b.id,
      categoryId: b.categoryId,
      month: formatIsoDate(b.month),
      limitAmount: b.limitAmount.toString(),
      notifiedAt: b.notifiedAt,
      category: { id: b.category.id, name: b.category.name, icon: b.category.icon, color: b.category.color },
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }
}
