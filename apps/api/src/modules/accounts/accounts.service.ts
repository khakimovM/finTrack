import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { AccountResponse, AccountListMeta } from '@fintrack/shared';
import { AccountsRepository, AccountWithCount } from './accounts.repository';
import { BalanceService } from './balance.service';
import { CreateAccountDto, UpdateAccountDto, ReorderAccountsDto } from './dto/account.dto';
import {
  NotFoundDomainException,
  ConflictDomainException,
} from '../../common/exceptions/domain.exception';

@Injectable()
export class AccountsService {
  constructor(
    private readonly repository: AccountsRepository,
    private readonly balanceService: BalanceService,
  ) {}

  async list(
    userId: string,
    includeArchived = false,
  ): Promise<{ data: AccountResponse[]; meta: AccountListMeta }> {
    const [accounts, { balances, total }] = await Promise.all([
      this.repository.findAll(userId, includeArchived),
      this.balanceService.getAccountBalances(userId),
    ]);

    const data: AccountResponse[] = accounts.map((acc) =>
      this.mapToResponse(acc, balances.get(acc.id) ?? acc.openingBalance),
    );

    return {
      data,
      meta: {
        totalBalance: total.toString(),
      },
    };
  }

  async getById(userId: string, id: string): Promise<AccountResponse> {
    const account = await this.repository.findById(userId, id);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    const balance = await this.balanceService.getBalance(userId, id);
    return this.mapToResponse(account, balance);
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountResponse> {
    const existing = await this.repository.findByName(userId, dto.name);
    if (existing) {
      throw new ConflictDomainException('ACCOUNT_EXISTS', 'Ushbu nomdagi hisob allaqachon mavjud');
    }

    const openingBalance = BigInt(dto.openingBalance ?? '0');
    const account = await this.repository.create(userId, {
      name: dto.name,
      type: dto.type as AccountType,
      currency: dto.currency ?? 'UZS',
      openingBalance,
      icon: dto.icon ?? '💳',
      color: dto.color ?? '#6366f1',
      isDefault: dto.isDefault ?? false,
    });

    await this.balanceService.invalidate(userId);

    return this.mapToResponse(
      {
        ...account,
        _count: { transactions: 0 },
      },
      openingBalance,
    );
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountResponse> {
    const account = await this.repository.findById(userId, id);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    if (dto.name && dto.name !== account.name) {
      const duplicate = await this.repository.findByName(userId, dto.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictDomainException('ACCOUNT_EXISTS', 'Ushbu nomdagi hisob allaqachon mavjud');
      }
    }

    const updated = await this.repository.update(userId, id, {
      name: dto.name,
      type: dto.type as AccountType | undefined,
      currency: dto.currency,
      openingBalance: dto.openingBalance !== undefined ? BigInt(dto.openingBalance) : undefined,
      icon: dto.icon,
      color: dto.color,
      isDefault: dto.isDefault,
    });

    if (dto.openingBalance !== undefined) {
      await this.balanceService.invalidate(userId);
    }

    const balance = await this.balanceService.getBalance(userId, id);
    return this.mapToResponse(
      {
        ...updated,
        _count: account._count,
      },
      balance,
    );
  }

  async toggleArchive(userId: string, id: string): Promise<AccountResponse> {
    const account = await this.repository.findById(userId, id);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    const newArchivedAt = account.archivedAt ? null : new Date();
    const updated = await this.repository.archive(userId, id, newArchivedAt);
    const balance = await this.balanceService.getBalance(userId, id);

    return this.mapToResponse(
      {
        ...updated,
        _count: account._count,
      },
      balance,
    );
  }

  async delete(userId: string, id: string): Promise<void> {
    const account = await this.repository.findById(userId, id);
    if (!account) {
      throw new NotFoundDomainException('Hisob topilmadi');
    }

    await this.repository.softDelete(userId, id);
    await this.balanceService.invalidate(userId);
  }

  async reorder(userId: string, dto: ReorderAccountsDto): Promise<void> {
    await this.repository.reorder(userId, dto.items);
  }

  private mapToResponse(account: AccountWithCount, balance: bigint): AccountResponse {
    return {
      id: account.id,
      name: account.name,
      type: account.type as AccountResponse['type'],
      currency: account.currency,
      openingBalance: account.openingBalance.toString(),
      balance: balance.toString(),
      icon: account.icon,
      color: account.color,
      isDefault: account.isDefault,
      sortOrder: account.sortOrder,
      archivedAt: account.archivedAt?.toISOString() ?? null,
      transactionCount: account._count?.transactions ?? 0,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
