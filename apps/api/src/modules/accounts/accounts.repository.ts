import { Injectable } from '@nestjs/common';
import { Account, AccountType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';

export interface AccountWithCount extends Account {
  _count: {
    transactions: number;
  };
}

export interface CreateAccountData {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: bigint;
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface UpdateAccountData {
  name?: string;
  type?: AccountType;
  currency?: string;
  openingBalance?: bigint;
  icon?: string;
  color?: string;
  isDefault?: boolean;
}

const liveTransactionCount = {
  _count: { select: { transactions: { where: { deletedAt: null } } } },
} as const;

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, includeArchived = false): Promise<AccountWithCount[]> {
    return this.prisma.account.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      include: liveTransactionCount,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(userId: string, id: string, db: Db = this.prisma): Promise<AccountWithCount | null> {
    return db.account.findFirst({
      where: { id, userId, deletedAt: null },
      include: liveTransactionCount,
    });
  }

  /** Accounts that may receive new ledger rows: live and not archived. */
  async findActiveById(userId: string, id: string, db: Db = this.prisma): Promise<Account | null> {
    return db.account.findFirst({ where: { id, userId, deletedAt: null, archivedAt: null } });
  }

  async findDefault(userId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { userId, deletedAt: null, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findByName(userId: string, name: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    });
  }

  async countActive(userId: string): Promise<number> {
    return this.prisma.account.count({ where: { userId, deletedAt: null, archivedAt: null } });
  }

  /** Anything that references the account and would lose meaning if the row disappeared. */
  async hasHistory(userId: string, id: string): Promise<boolean> {
    const [transactions, rules] = await Promise.all([
      this.prisma.transaction.count({ where: { userId, accountId: id } }),
      this.prisma.recurringRule.count({ where: { userId, accountId: id } }),
    ]);
    return transactions + rules > 0;
  }

  async create(userId: string, data: CreateAccountData): Promise<Account> {
    return this.prisma.$transaction(async (tx) => {
      const hasDefault = await tx.account.count({
        where: { userId, isDefault: true, deletedAt: null, archivedAt: null },
      });
      const isDefault = data.isDefault || hasDefault === 0;
      if (isDefault) {
        await tx.account.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.account.create({ data: { ...data, userId, isDefault } });
    });
  }

  async update(userId: string, id: string, data: UpdateAccountData): Promise<Account> {
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.account.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const updated = await tx.account.update({ where: { id, userId }, data });
      if (data.isDefault === false) await this.ensureDefault(tx, userId);
      return updated;
    });
  }

  /** Only used for accounts without history (see AccountsService.delete). */
  async hardDelete(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.account.delete({ where: { id, userId } });
      await this.ensureDefault(tx, userId);
    });
  }

  async setArchived(userId: string, id: string, archivedAt: Date | null): Promise<Account> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id, userId },
        data: { archivedAt, ...(archivedAt ? { isDefault: false } : {}) },
      });
      await this.ensureDefault(tx, userId);
      return tx.account.findUniqueOrThrow({ where: { id: updated.id } });
    });
  }

  async reorder(userId: string, items: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.account.updateMany({
          where: { id: item.id, userId, deletedAt: null },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  /** Keeps exactly one default among the user's active accounts (when any exist). */
  private async ensureDefault(tx: Db, userId: string): Promise<void> {
    const current = await tx.account.count({
      where: { userId, isDefault: true, deletedAt: null, archivedAt: null },
    });
    if (current > 0) return;

    const next = await tx.account.findFirst({
      where: { userId, deletedAt: null, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (next) {
      await tx.account.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}
