import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AdminQueue, AdminSystemResponse } from '@fintrack/shared';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { QUEUES } from '../../../infra/queue/queues';

/** A dependency that hangs must not hang the page that is meant to show it is down. */
const PROBE_TIMEOUT_MS = 2_000;
const RECENT_FAILURES = 5;
const REASON_LENGTH = 200;

const STARTED_AT = new Date();

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS).unref()),
  ]);
}

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; ms: number } | null> {
  const started = performance.now();
  try {
    const value = await withTimeout(work());
    return { value, ms: Math.round(performance.now() - started) };
  } catch {
    return null;
  }
}

/** What the owner checks first when something is off: is everything up, and what failed lately. */
@Injectable()
export class AdminSystemService {
  private readonly queues: Queue[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly telegram: TelegramBotService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.RECURRING) recurring: Queue,
    @InjectQueue(QUEUES.DEBT_REMINDERS) reminders: Queue,
    @InjectQueue(QUEUES.TELEGRAM_OUTBOX) outbox: Queue,
    @InjectQueue(QUEUES.DAILY_DIGEST) digest: Queue,
  ) {
    this.queues = [recurring, reminders, outbox, digest];
  }

  async status(): Promise<AdminSystemResponse> {
    const [database, redis, queues, telegram] = await Promise.all([
      this.database(),
      this.redisStatus(),
      Promise.all(this.queues.map((q) => this.queue(q))),
      this.telegramStatus(),
    ]);
    const commit = this.config.get<string>('RAILWAY_GIT_COMMIT_SHA');
    return {
      version: {
        commit: commit ? commit.slice(0, 7) : null,
        node: process.version,
        environment: this.config.get<string>('NODE_ENV') ?? 'development',
        startedAt: STARTED_AT.toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      database,
      redis,
      queues,
      telegram,
    };
  }

  private async database(): Promise<AdminSystemResponse['database']> {
    const ping = await timed(() => this.prisma.$queryRaw`SELECT 1`);
    if (!ping) return { status: 'down', latencyMs: null, sizeBytes: null, lastMigration: null };
    const details = await timed(() =>
      this.prisma.$queryRaw<[{ size: bigint; migration: string | null }]>`
        SELECT pg_database_size(current_database()) AS "size",
               (SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL
                ORDER BY "finished_at" DESC LIMIT 1) AS "migration"
      `,
    );
    const [row] = details?.value ?? [];
    return {
      status: 'ok',
      latencyMs: ping.ms,
      sizeBytes: row ? Number(row.size) : null,
      lastMigration: row?.migration ?? null,
    };
  }

  private async redisStatus(): Promise<AdminSystemResponse['redis']> {
    const client = this.redis.getClient();
    const ping = await timed(() => this.redis.ping());
    if (!client || !ping || ping.value !== 'PONG') return { status: 'down', latencyMs: null, usedMemoryBytes: null };
    const info = await timed(() => client.info('memory'));
    const used = info ? /used_memory:(\d+)/.exec(info.value)?.[1] : undefined;
    return { status: 'ok', latencyMs: ping.ms, usedMemoryBytes: used ? Number(used) : null };
  }

  private async queue(queue: Queue): Promise<AdminQueue> {
    const read = await timed(() =>
      Promise.all([
        queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
        queue.isPaused(),
        queue.getFailed(0, RECENT_FAILURES - 1),
      ]),
    );
    if (!read) return { name: queue.name, counts: null, recentFailures: [] };
    const [counts, paused, failed] = read.value;
    return {
      name: queue.name,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
        paused,
      },
      recentFailures: failed.map((job) => ({
        job: job.name,
        failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        attempts: job.attemptsMade,
        reason: (job.failedReason ?? '').slice(0, REASON_LENGTH),
      })),
    };
  }

  private async telegramStatus(): Promise<AdminSystemResponse['telegram']> {
    const bot = this.telegram.bot;
    const off = { webhookHost: null, pendingUpdates: null, lastErrorAt: null, lastError: null };
    if (!bot || !this.telegram.enabled) return { mode: 'off', ...off };

    const mode = this.config.get<string>('TELEGRAM_WEBHOOK_URL') ? 'webhook' : 'polling';
    const info = await timed(() => bot.api.getWebhookInfo());
    if (!info) return { mode, ...off };
    const webhook = info.value;
    return {
      mode,
      // The path of the webhook is not secret, but there is no reason to show more than the host.
      webhookHost: webhook.url ? new URL(webhook.url).host : null,
      pendingUpdates: webhook.pending_update_count,
      lastErrorAt: webhook.last_error_date ? new Date(webhook.last_error_date * 1000).toISOString() : null,
      lastError: webhook.last_error_message?.slice(0, REASON_LENGTH) ?? null,
    };
  }
}
