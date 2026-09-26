import { Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import {
  TransactionResponse,
  TransactionListMeta,
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
  BulkDeleteTransactionsInput,
} from '@fintrack/shared';
import {
  TransactionsRepository,
  TransactionWithRelations,
} from './transactions.repository';
import { AccountsRepository } from '../accounts/accounts.repository';
import { CategoriesRepository } from '../categories/categories.repository';
import { TagsRepository } from '../tags/tags.repository';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import {
  NotFoundDomainException,
  InvalidCategoryTypeException,
  InvalidTransactionTypeException,
  FutureDateException,
} from '../../common/exceptions/domain.exception';

import { BudgetsService } from '../budgets/budgets.service';

export interface BudgetAlert {
  categoryId: string;
  percent: number;
  limit: string;
  spent: string;
}

export interface CreateTransactionResult {
  transaction: TransactionResponse;
  accountBalance: string;
  totalBalance: string;
  budgetAlert: BudgetAlert | null;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repository: TransactionsRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly tagsRepository: TagsRepository,
    private readonly balanceService: BalanceService,
    private readonly balanceGuardService: BalanceGuardService,
    private readonly budgetsService: BudgetsService,
  ) {}

  async list(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<{ data: TransactionResponse[]; meta: TransactionListMeta }> {
    const [{ transactions, total }, sums] = await Promise.all([
      this.repository.findMany(userId, query),
      this.repository.calculateSums(userId, query),
    ]);

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data: transactions.map((t) => this.mapToResponse(t)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        sums,
      },
    };
  }

  async getById(userId: string, id: string): Promise<TransactionResponse> {
    const transaction = await this.repository.findById(userId, id);
    if (!transaction) {
      throw new NotFoundDomainException('Tranzaksiya topilmadi');
    }
    return this.mapToResponse(transaction);
  }

  async create(userId: string, dto: CreateTransactionInput): Promise<CreateTransactionResult> {
    if (dto.type !== 'INCOME' && dto.type !== 'EXPENSE') {
      throw new InvalidTransactionTypeException();
    }

    const txDate = new Date(dto.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (txDate > today) {
      throw new FutureDateException();
    }

    const account = await this.accountsRepository.findById(userId, dto.accountId);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    const category = await this.categoriesRepository.findById(userId, dto.categoryId);
    if (!category) {
      throw new NotFoundDomainException('Kategoriya topilmadi');
    }
    if (category.type !== dto.type) {
      throw new InvalidCategoryTypeException();
    }

    if (dto.tagIds && dto.tagIds.length > 0) {
      for (const tagId of dto.tagIds) {
        const tag = await this.tagsRepository.findById(userId, tagId);
        if (!tag) {
          throw new NotFoundDomainException('Teg topilmadi');
        }
      }
    }

    const amount = BigInt(dto.amount);

    if (dto.type === 'EXPENSE') {
      await this.balanceGuardService.assertSufficient(userId, dto.accountId, amount);
    }

    const created = await this.repository.create(
      userId,
      {
        type: dto.type as TransactionType,
        accountId: dto.accountId,
        amount,
        categoryId: dto.categoryId,
        date: txDate,
        note: dto.note,
      },
      dto.tagIds,
    );

    await this.balanceService.invalidate(userId);

    const [accountBalance, totalBalance] = await Promise.all([
      this.balanceService.getBalance(userId, dto.accountId),
      this.balanceService.getTotalBalance(userId),
    ]);

    let budgetAlert: BudgetAlert | null = null;
    if (dto.type === 'EXPENSE' && dto.categoryId) {
      budgetAlert = await this.budgetsService.checkAndNotify(userId, dto.categoryId, txDate);
    }

    return {
      transaction: this.mapToResponse(created),
      accountBalance: accountBalance.toString(),
      totalBalance: totalBalance.toString(),
      budgetAlert,
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionInput,
  ): Promise<TransactionResponse> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new NotFoundDomainException('Tranzaksiya topilmadi');
    }

    let txDate: Date | undefined;
    if (dto.date) {
      txDate = new Date(dto.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (txDate > today) {
        throw new FutureDateException();
      }
    }

    const targetAccountId = dto.accountId ?? existing.accountId;
    if (dto.accountId && dto.accountId !== existing.accountId) {
      const account = await this.accountsRepository.findById(userId, dto.accountId);
      if (!account) {
        throw new NotFoundDomainException('Hisob topilmadi');
      }
    }

    if (dto.categoryId !== undefined) {
      if (dto.categoryId !== null) {
        const category = await this.categoriesRepository.findById(userId, dto.categoryId);
        if (!category) {
          throw new NotFoundDomainException('Kategoriya topilmadi');
        }
        if (category.type !== existing.type) {
          throw new InvalidCategoryTypeException();
        }
      }
    }

    if (dto.tagIds && dto.tagIds.length > 0) {
      for (const tagId of dto.tagIds) {
        const tag = await this.tagsRepository.findById(userId, tagId);
        if (!tag) {
          throw new NotFoundDomainException('Teg topilmadi');
        }
      }
    }

    const targetAmount = dto.amount ? BigInt(dto.amount) : existing.amount;

    if (existing.type === 'EXPENSE') {
      const additionalAmount = targetAmount - existing.amount;
      if (additionalAmount > 0n || targetAccountId !== existing.accountId) {
        await this.balanceGuardService.assertSufficient(
          userId,
          targetAccountId,
          targetAccountId === existing.accountId ? additionalAmount : targetAmount,
        );
      }
    }

    const updated = await this.repository.update(
      userId,
      id,
      {
        accountId: dto.accountId,
        amount: dto.amount ? BigInt(dto.amount) : undefined,
        categoryId: dto.categoryId,
        date: txDate,
        note: dto.note,
      },
      dto.tagIds,
    );

    await this.balanceService.invalidate(userId);

    return this.mapToResponse(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new NotFoundDomainException('Tranzaksiya topilmadi');
    }

    await this.repository.softDelete(userId, existing);
    await this.balanceService.invalidate(userId);
  }

  async bulkDelete(userId: string, dto: BulkDeleteTransactionsInput): Promise<void> {
    await this.repository.bulkSoftDelete(userId, dto.ids);
    await this.balanceService.invalidate(userId);
  }

  async restore(userId: string, id: string): Promise<TransactionResponse> {
    const deleted = await this.repository.findDeletedById(userId, id);
    if (!deleted) {
      throw new NotFoundDomainException('O‘chirilgan tranzaksiya topilmadi');
    }

    await this.repository.restore(userId, deleted);
    await this.balanceService.invalidate(userId);

    const restored = await this.repository.findById(userId, id);
    if (!restored) {
      throw new NotFoundDomainException('Tranzaksiya topilmadi');
    }
    return this.mapToResponse(restored);
  }

  private mapToResponse(tx: TransactionWithRelations): TransactionResponse {
    const dateStr = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);

    return {
      id: tx.id,
      type: tx.type as TransactionResponse['type'],
      amount: tx.amount.toString(),
      date: dateStr,
      note: tx.note,
      account: {
        id: tx.account.id,
        name: tx.account.name,
        icon: tx.account.icon,
      },
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
            color: tx.category.color,
          }
        : null,
      tags: tx.tags.map((item) => ({
        id: item.tag.id,
        name: item.tag.name,
        color: item.tag.color,
      })),
      debtId: tx.debtId,
      transferGroupId: tx.transferGroupId,
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
