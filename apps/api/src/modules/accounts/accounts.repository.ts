import { Injectable } from '@nestjs/common';
import { Account, AccountType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

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
      include: {
        _count: {
          select: {
            transactions: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(userId: string, id: string): Promise<AccountWithCount | null> {
    return this.prisma.account.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            transactions: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  async findByName(userId: string, name: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: {
        userId,
        name,
        deletedAt: null,
      },
    });
  }

  async create(userId: string, data: CreateAccountData): Promise<Account> {
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.account.updateMany({
          where: { userId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      return tx.account.create({
        data: {
          userId,
          name: data.name,
          type: data.type,
          currency: data.currency,
          openingBalance: data.openingBalance,
          icon: data.icon,
          color: data.color,
          isDefault: data.isDefault,
        },
      });
    });
  }

  async update(userId: string, id: string, data: UpdateAccountData): Promise<Account> {
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.account.updateMany({
          where: { userId, isDefault: true, deletedAt: null, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.account.update({
        where: { id },
        data,
      });
    });
  }

  async softDelete(userId: string, id: string): Promise<Account> {
    return this.prisma.account.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async archive(userId: string, id: string, archivedAt: Date | null): Promise<Account> {
    return this.prisma.account.update({
      where: { id },
      data: { archivedAt },
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
}
