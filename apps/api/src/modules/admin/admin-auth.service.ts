import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import {
  AdminProfile,
  AdminSessionResponse,
  TelegramLoginStartResponse,
  TelegramLoginStatusResponse,
  VerifyTelegramLoginInput,
} from '@fintrack/shared';
import { TelegramLoginService } from '../auth/telegram-login.service';
import { AuthRepository } from '../auth/auth.repository';
import { TokenMeta } from '../auth/auth.service';
import { LOGIN_TEXT, describeDevice, noticeTime } from '../auth/telegram-login.messages';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { ClockService } from '../../infra/clock/clock.service';
import { AdminAccessService } from './core/admin-access.service';
import { AdminAuditService } from './core/admin-audit.service';
import { AdminPrincipal, AdminSessionService } from './admin-session.service';

function toProfile(user: User): AdminProfile {
  return { id: user.id, name: user.name, telegramUsername: user.telegramUsername };
}

/**
 * Admin sign-in: the ordinary Telegram code flow with purpose ADMIN, ending in an admin session
 * instead of a user one. With no admin configured every step answers 404.
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly access: AdminAccessService,
    private readonly login: TelegramLoginService,
    private readonly sessions: AdminSessionService,
    private readonly authRepository: AuthRepository,
    private readonly audit: AdminAuditService,
    private readonly telegram: TelegramBotService,
    private readonly clock: ClockService,
  ) {}

  start(meta: TokenMeta): Promise<TelegramLoginStartResponse> {
    this.ensureEnabled();
    return this.login.start(meta, 'ADMIN');
  }

  status(requestId: string): Promise<TelegramLoginStatusResponse> {
    this.ensureEnabled();
    return this.login.status(requestId, 'admin');
  }

  resend(requestId: string): Promise<TelegramLoginStatusResponse> {
    this.ensureEnabled();
    return this.login.resend(requestId, 'admin');
  }

  async verify(input: VerifyTelegramLoginInput, meta: TokenMeta): Promise<{ token: string; session: AdminSessionResponse }> {
    this.ensureEnabled();
    const { userId } = await this.login.redeem(input, 'ADMIN');
    const user = await this.authRepository.findUserById(userId);
    // Checked again here: the admin list may have changed since the bot sent the code.
    if (!user || !this.access.isAdmin(user.telegramId)) throw new NotFoundException();

    const { token, expiresAt } = await this.sessions.create(user.id, meta);
    await this.audit.record({
      action: 'LOGIN',
      adminUserId: user.id,
      telegramId: user.telegramId,
      ipAddress: meta.ipAddress,
      meta: { device: describeDevice(meta.userAgent) },
    });
    void this.notifySignIn(user, meta);
    return { token, session: { admin: toProfile(user), expiresAt: expiresAt.toISOString() } };
  }

  async me(admin: AdminPrincipal): Promise<AdminSessionResponse> {
    const user = await this.authRepository.findUserById(admin.userId);
    if (!user) throw new NotFoundException();
    return { admin: toProfile(user), expiresAt: admin.expiresAt.toISOString() };
  }

  async logout(token: string | undefined, meta: TokenMeta): Promise<void> {
    const ended = await this.sessions.revoke(token);
    if (ended) await this.audit.record({ action: 'LOGOUT', adminUserId: ended.userId, ipAddress: meta.ipAddress });
  }

  private ensureEnabled(): void {
    if (!this.access.enabled) throw new NotFoundException();
  }

  /** Every admin sign-in is announced in the admin's own chat; best effort. */
  private async notifySignIn(user: User, meta: TokenMeta): Promise<void> {
    if (user.telegramId === null) return;
    try {
      const time = noticeTime(this.clock.now(), user.timezone);
      await this.telegram.send(user.telegramId, LOGIN_TEXT.adminLogin(describeDevice(meta.userAgent), meta.ipAddress ?? null, time), {
        html: true,
      });
    } catch (err) {
      this.logger.warn(`Admin sign-in notice failed: ${String(err)}`);
    }
  }
}
