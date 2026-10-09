import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminRevokeSessionsResponse,
  AdminUserDetail,
  AdminUserRow,
  AdminUsersExportQuery,
  AdminUsersQuery,
  AdminUsersResponse,
  addDays,
  formatIsoDate,
  parseIsoDate,
} from '@fintrack/shared';
import { ClockService } from '../../../infra/clock/clock.service';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../../../common/exceptions/domain.exception';
import { toCsv } from '../../../common/utils/csv';
import { SessionStateService } from '../../auth/session-state.service';
import { LOGIN_TEXT } from '../../auth/telegram-login.messages';
import { AdminAccessService } from '../core/admin-access.service';
import { AdminPrincipal } from '../admin-session.service';
import { AdminUserRecord, AdminUsersRepository } from './admin-users.repository';

/** Same bound as the user's own transaction export: one file, built in memory. */
export const ADMIN_EXPORT_MAX_ROWS = 50_000;

/** "Channels" in the list mean the last 30 days; the detail shows 90 days of activity. */
const CHANNEL_DAYS = 30;
const ACTIVITY_DAYS = 90;

const CHANNEL_LABELS: Record<string, string> = { WEB: 'Sayt', MINIAPP: 'Mini App', BOT: 'Bot', UNKNOWN: 'Noma’lum' };
const STATUS_LABELS = { active: 'Faol', banned: 'Bloklangan', deleted: 'O‘chirilgan' } as const;

/** "+998 •• ••• •• 12": enough to tell two people apart, too little to call anyone. */
export function maskPhoneForAdmin(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  const tail = digits.slice(-2);
  return digits.startsWith('998') ? `+998 •• ••• •• ${tail}` : `+•• ••• •• ${tail}`;
}

export interface ActionContext {
  admin: AdminPrincipal;
  ipAddress: string | null;
}

@Injectable()
export class AdminUsersService {
  private readonly timeZone: string;

  constructor(
    private readonly repository: AdminUsersRepository,
    private readonly access: AdminAccessService,
    private readonly sessions: SessionStateService,
    private readonly telegram: TelegramBotService,
    private readonly clock: ClockService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? 'Asia/Tashkent';
  }

  async list(query: AdminUsersQuery): Promise<AdminUsersResponse> {
    const [total, records] = await Promise.all([
      this.repository.count(query),
      this.repository.page(query, (query.page - 1) * query.limit, query.limit, this.daysAgo(CHANNEL_DAYS - 1)),
    ]);
    return {
      data: records.map((r) => this.toRow(r)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) || 1 },
    };
  }

  async detail(id: string): Promise<AdminUserDetail> {
    const record = await this.find(id);
    const [counts, sources, days] = await Promise.all([
      this.repository.counts(id, this.clock.now()),
      this.repository.entriesBySource(id),
      this.repository.activity(id, parseIsoDate(this.daysAgo(ACTIVITY_DAYS - 1))),
    ]);
    const activity = new Map<string, AdminUserDetail['activity'][number]['channels']>();
    for (const { day, channel } of days) {
      const key = formatIsoDate(day);
      activity.set(key, [...(activity.get(key) ?? []), channel].sort());
    }
    return {
      user: {
        ...this.toRow(record),
        bannedAt: record.bannedAt?.toISOString() ?? null,
        banReason: record.banReason,
        deletedAt: record.deletedAt?.toISOString() ?? null,
        isAdmin: this.isAdmin(record),
      },
      counts: { entries: record.entries, accounts: record.accounts, ...counts },
      entriesBySource: {
        web: sources.get('WEB') ?? 0,
        miniApp: sources.get('MINIAPP') ?? 0,
        bot: sources.get('BOT') ?? 0,
        voice: sources.get('VOICE') ?? 0,
        recurring: sources.get('RECURRING') ?? 0,
        unknown: sources.get(null) ?? 0,
      },
      activity: [...activity].map(([day, channels]) => ({ day, channels })),
    };
  }

  /** The account can no longer sign in anywhere, and every open session ends now. */
  async ban(id: string, reason: string, ctx: ActionContext): Promise<AdminUserDetail> {
    const record = await this.find(id);
    if (record.deletedAt) throw new ConflictDomainException('CONFLICT', 'Hisob o‘chirilgan');
    if (this.isAdmin(record)) {
      throw new DomainException('Admin hisobini bloklab bo‘lmaydi', 'CANNOT_BAN_ADMIN', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const families = await this.repository.setBan(id, { reason, at: this.clock.now() }, {
      action: 'BAN',
      adminUserId: ctx.admin.userId,
      ipAddress: ctx.ipAddress,
    });
    if (!families) throw new ConflictDomainException('CONFLICT', 'Hisob allaqachon bloklangan');

    await this.sessions.revokeSessions(families);
    await this.sessions.forgetUser(id);
    await this.notify(record, LOGIN_TEXT.bannedNotice(reason));
    return this.detail(id);
  }

  async unban(id: string, ctx: ActionContext): Promise<AdminUserDetail> {
    const record = await this.find(id);
    const done = await this.repository.setBan(id, null, {
      action: 'UNBAN',
      adminUserId: ctx.admin.userId,
      ipAddress: ctx.ipAddress,
      meta: { reason: record.banReason },
    });
    if (!done) throw new ConflictDomainException('CONFLICT', 'Hisob bloklanmagan');

    await this.notify(record, LOGIN_TEXT.unbanned);
    return this.detail(id);
  }

  /** Signs the person out everywhere; they can sign in again (unlike a ban). */
  async revokeSessions(id: string, ctx: ActionContext): Promise<AdminRevokeSessionsResponse> {
    await this.find(id);
    const families = await this.repository.revokeSessions(id, { adminUserId: ctx.admin.userId, ipAddress: ctx.ipAddress });
    await this.sessions.revokeSessions(families);
    return { revoked: families.length };
  }

  /** The list as a spreadsheet: the same columns, every row. Recorded before it is handed out. */
  async exportCsv(query: AdminUsersExportQuery, ctx: ActionContext): Promise<string> {
    const total = await this.repository.count(query);
    if (total > ADMIN_EXPORT_MAX_ROWS) {
      throw new DomainException(
        `Juda ko‘p qator (${total}). Qidiruv yoki holat bo‘yicha toraytiring`,
        'EXPORT_TOO_LARGE',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { total, max: ADMIN_EXPORT_MAX_ROWS },
      );
    }
    const records = await this.repository.page(query, 0, ADMIN_EXPORT_MAX_ROWS, this.daysAgo(CHANNEL_DAYS - 1));
    await this.repository.audit({
      action: 'EXPORT',
      adminUserId: ctx.admin.userId,
      ipAddress: ctx.ipAddress,
      meta: { rows: records.length, status: query.status, sort: query.sort, q: query.q ?? null },
    });

    const headers = ['ID', 'Ism', 'Username', 'Telefon', 'Ro‘yxatdan o‘tgan', 'Oxirgi faollik', 'Yozuvlar', 'Hisoblar', 'Kanallar (30 kun)', 'Holat'];
    const rows = records.map((r) => {
      const row = this.toRow(r);
      return [
        row.id,
        row.name,
        row.telegramUsername ? `@${row.telegramUsername}` : '',
        row.phone ?? '',
        row.createdAt,
        row.lastSeenAt ?? '',
        String(row.entries),
        String(row.accounts),
        row.channels.map((c) => CHANNEL_LABELS[c]).join(', '),
        STATUS_LABELS[row.status] + (row.botBlocked ? ', botni bloklagan' : ''),
      ];
    });
    return toCsv(headers, rows);
  }

  private toRow(r: AdminUserRecord): AdminUserRow {
    return {
      id: r.id,
      name: r.name,
      telegramUsername: r.telegramUsername,
      phone: maskPhoneForAdmin(r.phone),
      createdAt: r.createdAt.toISOString(),
      lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
      entries: r.entries,
      accounts: r.accounts,
      channels: r.channels,
      status: r.deletedAt ? 'deleted' : r.bannedAt ? 'banned' : 'active',
      botBlocked: r.telegramBlockedAt !== null,
    };
  }

  private async find(id: string): Promise<AdminUserRecord> {
    const record = await this.repository.findById(id, this.daysAgo(CHANNEL_DAYS - 1));
    if (!record) throw new NotFoundDomainException('Foydalanuvchi topilmadi');
    return record;
  }

  private isAdmin(record: AdminUserRecord): boolean {
    return record.telegramId !== null && this.access.isAdmin(record.telegramId);
  }

  /** Best effort: a person who blocked the bot just does not hear about it. */
  private async notify(record: AdminUserRecord, text: string): Promise<void> {
    if (record.telegramId && !record.telegramBlockedAt) await this.telegram.send(record.telegramId, text, { html: true });
  }

  private daysAgo(days: number): string {
    return formatIsoDate(addDays(parseIsoDate(this.clock.todayIn(this.timeZone)), -days));
  }
}
