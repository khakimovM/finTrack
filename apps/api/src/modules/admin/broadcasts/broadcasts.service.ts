import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Broadcast } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import {
  BroadcastAudience,
  BroadcastListQuery,
  BroadcastListResponse,
  BroadcastPreviewResponse,
  BroadcastResponse,
  CreateBroadcastInput,
  addDays,
  formatIsoDate,
  parseIsoDate,
} from '@fintrack/shared';
import { ClockService } from '../../../infra/clock/clock.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { JOBS, QUEUES } from '../../../infra/queue/queues';
import { ConflictDomainException, DomainException, NotFoundDomainException } from '../../../common/exceptions/domain.exception';
import { ActionContext } from '../users/admin-users.service';
import { Audience, BroadcastsRepository } from './broadcasts.repository';

/** How long a test send vouches for its text: long enough to read it and press "send". */
const TESTED_SECONDS = 60 * 60;

const testedKey = (adminUserId: string, text: string) =>
  `admin:broadcast:tested:${adminUserId}:${createHash('sha256').update(text).digest('hex')}`;

@Injectable()
export class BroadcastsService {
  private readonly timeZone: string;

  constructor(
    private readonly repository: BroadcastsRepository,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly telegram: TelegramBotService,
    private readonly clock: ClockService,
    @InjectQueue(QUEUES.BROADCAST) private readonly queue: Queue,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Tashkent';
  }

  async preview(audience: BroadcastAudience): Promise<BroadcastPreviewResponse> {
    const { recipients, botBlocked, optedOut } = await this.repository.preview(this.audience(audience));
    return { recipients, excluded: { botBlocked, optedOut } };
  }

  /** Sends the text to the admin alone, exactly as people will see it, and remembers that it was tried. */
  async test(text: string, ctx: ActionContext): Promise<{ delivered: true }> {
    const admin = await this.prisma.user.findUnique({ where: { id: ctx.admin.userId }, select: { telegramId: true } });
    const result = admin?.telegramId ? await this.telegram.send(admin.telegramId, text) : 'FAILED';
    if (result !== 'SENT') {
      throw new DomainException(
        result === 'BLOCKED' ? 'Botni bloklagansiz: avval botga /start yozing' : 'Test xabarni yuborib bo‘lmadi',
        'TEST_NOT_DELIVERED',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.redis.set(testedKey(ctx.admin.userId, text), '1', TESTED_SECONDS);
    return { delivered: true };
  }

  async create(input: CreateBroadcastInput, ctx: ActionContext): Promise<BroadcastResponse> {
    if ((await this.redis.get(testedKey(ctx.admin.userId, input.text))) !== '1') {
      throw new DomainException(
        'Avval shu matnni o‘zingizga test sifatida yuboring',
        'BROADCAST_NOT_TESTED',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (await this.repository.findUnfinished()) {
      throw new ConflictDomainException('BROADCAST_IN_PROGRESS', 'Oldingi xabar hali yuborilmoqda');
    }

    const { broadcast, actual } = await this.repository.create(
      { adminUserId: ctx.admin.userId, text: input.text, ipAddress: ctx.ipAddress },
      this.audience(input),
      input.expectedRecipients,
    );
    if (!broadcast) {
      throw new ConflictDomainException('RECIPIENTS_CHANGED', `Qabul qiluvchilar soni o‘zgardi: endi ${actual} kishi`, {
        recipients: actual,
      });
    }
    // The job id is the broadcast: adding it twice queues it once.
    await this.queue.add(JOBS.DELIVER_BROADCAST, { broadcastId: broadcast.id }, {
      jobId: `broadcast-${broadcast.id}`,
      attempts: 3,
      backoff: { type: 'fixed', delay: 10_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    });
    return this.toResponse(broadcast, await this.adminNames([broadcast]));
  }

  async list(query: BroadcastListQuery): Promise<BroadcastListResponse> {
    const { rows, total } = await this.repository.list((query.page - 1) * query.limit, query.limit);
    const names = await this.adminNames(rows);
    return {
      data: rows.map((b) => this.toResponse(b, names)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) || 1 },
    };
  }

  async get(id: string): Promise<BroadcastResponse> {
    const broadcast = await this.repository.findById(id);
    if (!broadcast) throw new NotFoundDomainException('Xabar topilmadi');
    return this.toResponse(broadcast, await this.adminNames([broadcast]));
  }

  private audience(a: BroadcastAudience): Audience {
    const today = this.clock.todayIn(this.timeZone);
    return { ...a, since: formatIsoDate(addDays(parseIsoDate(today), -29)) };
  }

  private async adminNames(rows: Broadcast[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.adminUserId))];
    const people = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(people.map((p) => [p.id, p.name]));
  }

  private toResponse(b: Broadcast, names: Map<string, string>): BroadcastResponse {
    return {
      id: b.id,
      text: b.text,
      segment: b.segment,
      includeOptedOut: b.includeOptedOut,
      status: b.status,
      total: b.total,
      sent: b.sent,
      blocked: b.blocked,
      failed: b.failed,
      pending: Math.max(0, b.total - b.sent - b.blocked - b.failed),
      admin: { id: b.adminUserId, name: names.get(b.adminUserId) ?? '—' },
      createdAt: b.createdAt.toISOString(),
      startedAt: b.startedAt?.toISOString() ?? null,
      finishedAt: b.finishedAt?.toISOString() ?? null,
    };
  }
}
