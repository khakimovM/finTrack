import { Injectable } from '@nestjs/common';
import {
  TelegramLoginPurpose,
  TelegramLoginRequest,
  TelegramLoginStatus,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { Db } from '../../infra/prisma/prisma.types';

@Injectable()
export class TelegramLoginRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    purpose: TelegramLoginPurpose;
    nonceHash: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<TelegramLoginRequest> {
    return this.prisma.telegramLoginRequest.create({ data });
  }

  async findById(id: string): Promise<TelegramLoginRequest | null> {
    return this.prisma.telegramLoginRequest.findUnique({ where: { id } });
  }

  async findByNonceHash(nonceHash: string): Promise<TelegramLoginRequest | null> {
    return this.prisma.telegramLoginRequest.findUnique({ where: { nonceHash } });
  }

  /** The newest request that is waiting for this Telegram user's contact. */
  async findAwaitingContact(telegramId: bigint): Promise<TelegramLoginRequest | null> {
    return this.prisma.telegramLoginRequest.findFirst({
      where: { telegramId, status: 'AWAITING_CONTACT', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Serialises code verification so parallel guesses cannot exceed the attempt limit. */
  async lock(db: Db, id: string): Promise<TelegramLoginRequest | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM telegram_login_requests WHERE id = ${id} FOR UPDATE
    `;
    if (rows.length === 0) return null;
    return db.telegramLoginRequest.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: Partial<{
      status: TelegramLoginStatus;
      userId: string;
      telegramId: bigint;
      codeHash: string | null;
      codeExpiresAt: Date | null;
      attempts: number;
      codesSent: number;
      consumedAt: Date;
    }>,
    db: Db = this.prisma,
  ): Promise<TelegramLoginRequest> {
    return db.telegramLoginRequest.update({ where: { id }, data });
  }

  /** Only moves forward from an expected state: a stale bot callback cannot resurrect a request. */
  async transition(id: string, from: TelegramLoginStatus[], to: TelegramLoginStatus): Promise<boolean> {
    const result = await this.prisma.telegramLoginRequest.updateMany({
      where: { id, status: { in: from } },
      data: { status: to },
    });
    return result.count === 1;
  }

  /** Housekeeping: requests are useless an hour after they expire. */
  async purgeExpired(before: Date): Promise<number> {
    const result = await this.prisma.telegramLoginRequest.deleteMany({ where: { expiresAt: { lt: before } } });
    return result.count;
  }
}
