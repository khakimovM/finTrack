import { Injectable } from '@nestjs/common';
import { Transaction, TransactionSource } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';

export interface CreateTransferRepoData {
  fromAccountId: string;
  toAccountId: string;
  amount: bigint;
  date: Date;
  note?: string | null;
  source: TransactionSource;
}

export interface CreatedTransferResult {
  transferGroupId: string;
  outTx: Transaction;
  inTx: Transaction;
}

@Injectable()
export class TransfersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Both legs in the caller's transaction: a transfer never exists half-written. */
  async createTransfer(db: Db, userId: string, data: CreateTransferRepoData): Promise<CreatedTransferResult> {
    const transferGroupId = `tg_${randomUUID()}`;
    const common = { userId, amount: data.amount, transferGroupId, date: data.date, note: data.note, source: data.source };

    const outTx = await db.transaction.create({
      data: { ...common, accountId: data.fromAccountId, type: 'TRANSFER_OUT' },
    });
    const inTx = await db.transaction.create({
      data: { ...common, accountId: data.toAccountId, type: 'TRANSFER_IN' },
    });
    return { transferGroupId, outTx, inTx };
  }

  async findLiveLegs(userId: string, transferGroupId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId, transferGroupId, deletedAt: null },
    });
  }

  async softDeleteGroup(db: Db, userId: string, transferGroupId: string): Promise<number> {
    const result = await db.transaction.updateMany({
      where: { userId, transferGroupId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }
}
