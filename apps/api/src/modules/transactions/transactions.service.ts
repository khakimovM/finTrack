import { Injectable } from '@nestjs/common';
import { Transaction, TransactionType } from '@prisma/client';
import {
  TransactionResponse,
  TransactionListMeta,
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
  BulkDeleteTransactionsInput,
  isUserManagedTransactionType,
  formatIsoDate,
  parseIsoDate,
} from '@fintrack/shared';
import { TransactionsRepository, TransactionWithRelations } from './transactions.repository';
import { AccountAccessService } from '../accounts/account-access.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { TagsRepository } from '../tags/tags.repository';
import { BalanceService } from '../accounts/balance.service';
import { BalanceGuardService } from '../accounts/balance-guard.service';
import { balanceDeltas } from '../accounts/ledger-effect';
import { BudgetsService, BudgetAlert } from '../budgets/budgets.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ClockService } from '../../infra/clock/clock.service';
import {
  InvalidCategoryTypeException,
  InvalidTransactionTypeException,
  ManagedTransactionException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';

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
    private readonly accountAccess: AccountAccessService,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly tagsRepository: TagsRepository,
    private readonly balanceService: BalanceService,
    private readonly balanceGuard: BalanceGuardService,
    private readonly budgetsService: BudgetsService,
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
  ) {}

  async list(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<{ data: TransactionResponse[]; meta: TransactionListMeta }> {
    const [{ transactions, total }, sums] = await Promise.all([
      this.repository.findMany(userId, query),
      this.repository.calculateSums(userId, query),
    ]);
    const peers = await this.repository.findTransferPeers(userId, transactions);

    return {
      data: transactions.map((t) => this.mapToResponse(t, peers.get(t.id))),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
        sums,
      },
    };
  }

  async getById(userId: string, id: string): Promise<TransactionResponse> {
    const transaction = await this.repository.findById(userId, id);
    if (!transaction) throw new NotFoundDomainException('Tranzaksiya topilmadi');
    const peers = await this.repository.findTransferPeers(userId, [transaction]);
    return this.mapToResponse(transaction, peers.get(transaction.id));
  }

  async create(userId: string, dto: CreateTransactionInput): Promise<CreateTransactionResult> {
    if (!isUserManagedTransactionType(dto.type)) throw new InvalidTransactionTypeException();

    await this.clock.assertNotFuture(userId, dto.date);
    await this.accountAccess.assertWritable(userId, dto.accountId);
    await this.assertCategory(userId, dto.categoryId, dto.type);
    await this.assertTags(userId, dto.tagIds);

    const type = dto.type as TransactionType;
    const amount = BigInt(dto.amount);
    const date = parseIsoDate(dto.date);

    const created = await this.prisma.$transaction(async (db) => {
      if (type === 'EXPENSE') {
        await this.balanceGuard.assertCanDebit(db, userId, dto.accountId, amount);
      }
      return this.repository.create(
        db,
        userId,
        { type, accountId: dto.accountId, amount, categoryId: dto.categoryId, date, note: dto.note },
        [...new Set(dto.tagIds ?? [])],
      );
    });

    await this.balanceService.invalidate(userId, [dto.accountId]);

    const [accountBalance, totalBalance, budgetAlert] = await Promise.all([
      this.balanceService.getBalance(userId, dto.accountId),
      this.balanceService.getTotalBalance(userId),
      type === 'EXPENSE'
        ? this.budgetsService.checkAndNotify(userId, dto.categoryId, date)
        : Promise.resolve(null),
    ]);

    return {
      transaction: this.mapToResponse(created),
      accountBalance: accountBalance.toString(),
      totalBalance: totalBalance.toString(),
      budgetAlert,
    };
  }

  async update(userId: string, id: string, dto: UpdateTransactionInput): Promise<TransactionResponse> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) throw new NotFoundDomainException('Tranzaksiya topilmadi');
    this.assertUserManaged(existing);

    if (dto.date) await this.clock.assertNotFuture(userId, dto.date);
    if (dto.accountId && dto.accountId !== existing.accountId) {
      await this.accountAccess.assertWritable(userId, dto.accountId);
    }
    // Income can become expense and back; the category, given or kept, must match the new type.
    const type = dto.type ?? existing.type;
    const categoryId = dto.categoryId !== undefined ? dto.categoryId : existing.categoryId;
    if (categoryId !== null && (dto.categoryId !== undefined || type !== existing.type)) {
      await this.assertCategory(userId, categoryId, type);
    }
    await this.assertTags(userId, dto.tagIds);

    const accountId = dto.accountId ?? existing.accountId;
    const amount = dto.amount ? BigInt(dto.amount) : existing.amount;
    const date = dto.date ? parseIsoDate(dto.date) : undefined;

    const deltas = balanceDeltas(
      [{ accountId: existing.accountId, type: existing.type, amount: existing.amount }],
      [{ accountId, type, amount }],
    );

    const updated = await this.prisma.$transaction(async (db) => {
      await this.balanceGuard.assertDeltas(db, userId, deltas);
      return this.repository.update(
        db,
        userId,
        id,
        {
          type: dto.type,
          accountId: dto.accountId,
          amount: dto.amount ? amount : undefined,
          categoryId: dto.categoryId,
          date,
          note: dto.note,
        },
        dto.tagIds ? [...new Set(dto.tagIds)] : undefined,
      );
    });

    await this.balanceService.invalidate(userId, [existing.accountId, accountId]);
    await this.notifyBudget(userId, updated);
    return this.mapToResponse(updated);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) throw new NotFoundDomainException('Tranzaksiya topilmadi');
    this.assertUserManaged(existing);

    await this.removeRows(userId, [existing]);
  }

  async bulkDelete(userId: string, dto: BulkDeleteTransactionsInput): Promise<void> {
    const rows = await this.repository.findLiveByIds(userId, [...new Set(dto.ids)]);
    const managed = rows.filter((row) => !isUserManagedTransactionType(row.type));
    if (managed.length > 0) {
      throw new ManagedTransactionException({ transactionIds: managed.map((row) => row.id) });
    }
    if (rows.length === 0) return;

    await this.removeRows(userId, rows);
  }

  async restore(userId: string, id: string): Promise<TransactionResponse> {
    const deleted = await this.repository.findDeletedById(userId, id);
    if (!deleted) throw new NotFoundDomainException('O‘chirilgan tranzaksiya topilmadi');
    this.assertUserManaged(deleted);

    const deltas = balanceDeltas([], [deleted]);
    const restored = await this.prisma.$transaction(async (db) => {
      await this.balanceGuard.assertDeltas(db, userId, deltas);
      await this.repository.restore(db, userId, id);
      return this.repository.findById(userId, id, db);
    });
    if (!restored) throw new NotFoundDomainException('Tranzaksiya topilmadi');

    await this.balanceService.invalidate(userId, [deleted.accountId]);
    await this.notifyBudget(userId, restored);
    return this.mapToResponse(restored);
  }

  private async removeRows(userId: string, rows: Transaction[]): Promise<void> {
    const deltas = balanceDeltas(rows, []);
    await this.prisma.$transaction(async (db) => {
      await this.balanceGuard.assertDeltas(db, userId, deltas);
      await this.repository.softDelete(
        db,
        userId,
        rows.map((row) => row.id),
      );
    });
    await this.balanceService.invalidate(
      userId,
      rows.map((row) => row.accountId),
    );
  }

  private assertUserManaged(row: Pick<Transaction, 'id' | 'type' | 'transferGroupId' | 'debtId'>): void {
    if (!isUserManagedTransactionType(row.type)) {
      throw new ManagedTransactionException({
        transactionId: row.id,
        transferGroupId: row.transferGroupId,
        debtId: row.debtId,
      });
    }
  }

  private async assertCategory(userId: string, categoryId: string, type: TransactionType): Promise<void> {
    const category = await this.categoriesRepository.findById(userId, categoryId);
    if (!category) throw new NotFoundDomainException('Kategoriya topilmadi');
    if (category.type !== type) throw new InvalidCategoryTypeException();
  }

  private async assertTags(userId: string, tagIds?: string[]): Promise<void> {
    if (!tagIds || tagIds.length === 0) return;
    const unique = [...new Set(tagIds)];
    if ((await this.tagsRepository.countOwned(userId, unique)) !== unique.length) {
      throw new NotFoundDomainException('Teg topilmadi');
    }
  }

  private async notifyBudget(userId: string, tx: TransactionWithRelations): Promise<void> {
    if (tx.type === 'EXPENSE' && tx.categoryId) {
      await this.budgetsService.checkAndNotify(userId, tx.categoryId, tx.date);
    }
  }

  private mapToResponse(
    tx: TransactionWithRelations,
    transferPeer: TransactionResponse['transferPeer'] = null,
  ): TransactionResponse {
    return {
      id: tx.id,
      type: tx.type as TransactionResponse['type'],
      amount: tx.amount.toString(),
      date: formatIsoDate(tx.date),
      note: tx.note,
      account: { id: tx.account.id, name: tx.account.name, icon: tx.account.icon },
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
            color: tx.category.color,
          }
        : null,
      tags: tx.tags.map((item) => ({ id: item.tag.id, name: item.tag.name, color: item.tag.color })),
      debtId: tx.debtId,
      debt: tx.debt ? { id: tx.debt.id, personName: tx.debt.personName } : null,
      transferGroupId: tx.transferGroupId,
      transferPeer: transferPeer ?? null,
      createdAt: tx.createdAt.toISOString(),
    };
  }
}
