import { Injectable, Logger } from '@nestjs/common';
import { BudgetsRepository, BudgetWithCategory } from './budgets.repository';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CategoriesRepository } from '../categories/categories.repository';
import {
  NotFoundDomainException,
  ConflictDomainException,
} from '../../common/exceptions/domain.exception';
import { startOfMonth, endOfMonth, parseIsoDate, formatIsoDate } from '@fintrack/shared';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private readonly repository: BudgetsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  private parseMonth(monthStr?: string): { monthDate: Date; start: Date; end: Date } {
    let date: Date;
    if (!monthStr) {
      date = new Date();
    } else {
      // If YYYY-MM provided, append -01
      const normalized = monthStr.length === 7 ? `${monthStr}-01` : monthStr;
      date = parseIsoDate(normalized);
    }

    const monthDate = startOfMonth(date);
    const end = endOfMonth(date);

    return { monthDate, start: monthDate, end };
  }

  async list(userId: string, monthStr?: string) {
    const { monthDate } = this.parseMonth(monthStr);
    const items = await this.repository.findManyByMonth(userId, monthDate);
    return items.map(this.mapToResponse);
  }

  async getStatus(userId: string, monthStr?: string) {
    const { monthDate, start, end } = this.parseMonth(monthStr);
    const budgets = await this.repository.findManyByMonth(userId, monthDate);

    let totalLimit = 0n;
    let totalSpent = 0n;

    const data = await Promise.all(
      budgets.map(async (b) => {
        const spent = await this.repository.getCategorySpent(userId, b.categoryId, start, end);
        totalLimit += b.limitAmount;
        totalSpent += spent;

        const limitNum = Number(b.limitAmount);
        const spentNum = Number(spent);
        const percent = limitNum > 0 ? Number(((spentNum / limitNum) * 100).toFixed(1)) : 0;

        const remaining = b.limitAmount > spent ? b.limitAmount - spent : 0n;

        let state: 'OK' | 'WARNING' | 'EXCEEDED' = 'OK';
        if (percent > 100) {
          state = 'EXCEEDED';
        } else if (percent >= 80) {
          state = 'WARNING';
        }

        return {
          id: b.id,
          category: {
            id: b.category.id,
            name: b.category.name,
            icon: b.category.icon,
            color: b.category.color,
          },
          limitAmount: b.limitAmount.toString(),
          spent: spent.toString(),
          remaining: remaining.toString(),
          percent,
          state,
        };
      }),
    );

    const monthKey = formatIsoDate(monthDate).slice(0, 7);

    return {
      data,
      meta: {
        month: monthKey,
        totalLimit: totalLimit.toString(),
        totalSpent: totalSpent.toString(),
      },
    };
  }

  async create(userId: string, dto: CreateBudgetDto) {
    const category = await this.categoriesRepository.findById(userId, dto.categoryId);
    if (!category) {
      throw new NotFoundDomainException('Kategoriya topilmadi');
    }

    const { monthDate } = this.parseMonth(dto.month);

    const existing = await this.repository.findByCategoryAndMonth(
      userId,
      dto.categoryId,
      monthDate,
    );
    if (existing) {
      throw new ConflictDomainException(
        'BUDGET_EXISTS',
        'Ushbu oy uchun ushbu kategoriyada byudjet allaqachon mavjud',
      );
    }

    const created = await this.repository.create(userId, {
      categoryId: dto.categoryId,
      month: monthDate,
      limitAmount: BigInt(dto.limitAmount),
    });

    return this.mapToResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto) {
    const updated = await this.repository.update(userId, id, {
      limitAmount: BigInt(dto.limitAmount),
    });

    if (!updated) {
      throw new NotFoundDomainException('Byudjet topilmadi');
    }

    return this.mapToResponse(updated);
  }

  async delete(userId: string, id: string) {
    const deleted = await this.repository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundDomainException('Byudjet topilmadi');
    }
  }

  /**
   * Called on EXPENSE transaction creation.
   * Checks budget thresholds (80% and 100%) and safely creates notifications.
   * Never throws so it won't block the transaction!
   */
  async checkAndNotify(
    userId: string,
    categoryId: string,
    txDate: Date,
  ): Promise<{
    categoryId: string;
    percent: number;
    limit: string;
    spent: string;
  } | null> {
    try {
      const monthDate = startOfMonth(txDate);
      const budget = await this.repository.findByCategoryAndMonth(userId, categoryId, monthDate);
      if (!budget) return null;

      const end = endOfMonth(txDate);
      const spent = await this.repository.getCategorySpent(userId, categoryId, monthDate, end);

      const limitNum = Number(budget.limitAmount);
      const spentNum = Number(spent);
      if (limitNum <= 0) return null;

      const percent = Number(((spentNum / limitNum) * 100).toFixed(1));

      // 80% threshold check (one-time alert)
      if (percent >= 80 && percent < 100 && budget.notifiedAt < 80) {
        await this.notificationsService.createSafe(userId, {
          type: 'BUDGET_WARNING',
          title: 'Byudjet chegarasi ogohlantirishi',
          body: `"${budget.category.name}" kategoriyasi bo‘yicha byudjetning ${percent}% qismi sarflandi.`,
          meta: {
            budgetId: budget.id,
            categoryId: budget.categoryId,
            percent,
          },
        });
        await this.repository.updateNotifiedAt(budget.id, 80);
      }

      // 100% threshold check (one-time alert)
      if (percent >= 100 && budget.notifiedAt < 100) {
        await this.notificationsService.createSafe(userId, {
          type: 'BUDGET_EXCEEDED',
          title: 'Byudjet chegarasi oshib ketdi',
          body: `"${budget.category.name}" kategoriyasi bo‘yicha belgilangan byudjet ${percent}% ga yetdi va limitdan oshdi!`,
          meta: {
            budgetId: budget.id,
            categoryId: budget.categoryId,
            percent,
          },
        });
        await this.repository.updateNotifiedAt(budget.id, 100);
      }

      if (percent >= 80) {
        return {
          categoryId: budget.categoryId,
          percent,
          limit: budget.limitAmount.toString(),
          spent: spent.toString(),
        };
      }

      return null;
    } catch (err) {
      this.logger.error('Error in checkAndNotify (safe fallback)', err);
      return null;
    }
  }

  private mapToResponse(b: BudgetWithCategory) {
    return {
      id: b.id,
      categoryId: b.categoryId,
      month: formatIsoDate(b.month),
      limitAmount: b.limitAmount.toString(),
      notifiedAt: b.notifiedAt,
      category: {
        id: b.category.id,
        name: b.category.name,
        icon: b.category.icon,
        color: b.category.color,
      },
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }
}
