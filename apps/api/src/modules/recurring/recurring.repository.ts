import { Injectable } from '@nestjs/common';
import { Prisma, RecurringRule, RecurrenceFrequency, TransactionType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type RecurringRuleWithRelations = RecurringRule & {
  account: {
    id: string;
    name: string;
    icon: string;
  };
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
};

export interface CreateRecurringData {
  accountId: string;
  categoryId?: string | null;
  type: TransactionType;
  amount: bigint;
  frequency: RecurrenceFrequency;
  dayOfCycle?: number | null;
  startsAt: Date;
  endsAt?: Date | null;
  nextRunAt: Date;
  note?: string | null;
}

export interface UpdateRecurringData {
  amount?: bigint;
  note?: string | null;
  isActive?: boolean;
  dayOfCycle?: number | null;
  endsAt?: Date | null;
  nextRunAt?: Date;
}

@Injectable()
export class RecurringRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getRelationsInclude() {
    return {
      account: {
        select: { id: true, name: true, icon: true },
      },
      category: {
        select: { id: true, name: true, icon: true, color: true },
      },
    };
  }

  async findMany(userId: string, isActive?: boolean): Promise<RecurringRuleWithRelations[]> {
    const where: Prisma.RecurringRuleWhereInput = {
      userId,
      ...(isActive !== undefined ? { isActive } : {}),
    };

    return this.prisma.recurringRule.findMany({
      where,
      include: this.getRelationsInclude(),
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });
  }

  async findById(userId: string, id: string): Promise<RecurringRuleWithRelations | null> {
    return this.prisma.recurringRule.findFirst({
      where: { id, userId },
      include: this.getRelationsInclude(),
    });
  }

  async create(userId: string, data: CreateRecurringData): Promise<RecurringRuleWithRelations> {
    return this.prisma.recurringRule.create({
      data: {
        userId,
        accountId: data.accountId,
        categoryId: data.categoryId,
        type: data.type,
        amount: data.amount,
        frequency: data.frequency,
        dayOfCycle: data.dayOfCycle,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        nextRunAt: data.nextRunAt,
        note: data.note,
        isActive: true,
      },
      include: this.getRelationsInclude(),
    });
  }

  async update(
    userId: string,
    id: string,
    data: UpdateRecurringData,
  ): Promise<RecurringRuleWithRelations> {
    return this.prisma.recurringRule.update({
      where: { id, userId },
      data: {
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.dayOfCycle !== undefined ? { dayOfCycle: data.dayOfCycle } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
        ...(data.nextRunAt !== undefined ? { nextRunAt: data.nextRunAt } : {}),
      },
      include: this.getRelationsInclude(),
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.prisma.recurringRule.delete({
      where: { id, userId },
    });
  }

  async findDueRules(currentDate: Date): Promise<RecurringRuleWithRelations[]> {
    return this.prisma.recurringRule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: currentDate },
      },
      include: this.getRelationsInclude(),
      orderBy: { nextRunAt: 'asc' },
    });
  }

  async findExistingTransaction(ruleId: string, date: Date) {
    return this.prisma.transaction.findFirst({
      where: {
        recurringRuleId: ruleId,
        date,
        deletedAt: null,
      },
    });
  }
}
