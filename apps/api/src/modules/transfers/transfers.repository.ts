import { Injectable } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface CreateTransferRepoData {
  fromAccountId: string;
  toAccountId: string;
  amount: bigint;
  date: Date;
  note?: string | null;
}

export interface CreatedTransferResult {
  transferGroupId: string;
  outTx: Transaction;
  inTx: Transaction;
}

@Injectable()
export class TransfersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createTransfer(userId: string, data: CreateTransferRepoData): Promise<CreatedTransferResult> {
    const transferGroupId = `tg_${randomUUID()}`;

    return this.prisma.$transaction(async (tx) => {
      const outTx = await tx.transaction.create({
        data: {
          userId,
          accountId: data.fromAccountId,
          type: 'TRANSFER_OUT',
          amount: data.amount,
          transferGroupId,
          date: data.date,
          note: data.note,
        },
      });

      const inTx = await tx.transaction.create({
        data: {
          userId,
          accountId: data.toAccountId,
          type: 'TRANSFER_IN',
          amount: data.amount,
          transferGroupId,
          date: data.date,
          note: data.note,
        },
      });

      return {
        transferGroupId,
        outTx,
        inTx,
      };
    });
  }

  async deleteTransfer(userId: string, transferGroupId: string): Promise<number> {
    const result = await this.prisma.transaction.updateMany({
      where: {
        transferGroupId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return result.count;
  }
}
