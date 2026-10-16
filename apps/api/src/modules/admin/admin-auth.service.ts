import { HttpStatus, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { validateInitData } from '../auth/telegram-init-data';
import { DomainException } from '../../common/exceptions/domain.exception';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { ClockService } from '../../infra/clock/clock.service';
import { RedisService } from '../../infra/redis/redis.service';
import { AdminAccessService } from './core/admin-access.service';
import { AdminAuditService } from './core/admin-audit.service';
import { AdminPrincipal, AdminSessionService } from './admin-session.service';

/**
 * How old the launch data of an admin Mini App may be. The panel exchanges it as soon as it
 * opens, so minutes are plenty (user Mini Apps allow a day).
 */
export const ADMIN_INIT_DATA_MAX_AGE_SECONDS = 10 * 60;
/** Launch data already exchanged for an admin session, by its hash. */
export const ADMIN_WEBAPP_KEY = 'admin:webapp:';

/** A new admin session: the token goes into the cookie, or to the Mini App in the body. */
export interface AdminSignIn {
  token: string;
  session: AdminSessionResponse;
}

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
  private readonly botToken?: string;

  constructor(
    private readonly access: AdminAccessService,
    private readonly login: TelegramLoginService,
    private readonly sessions: AdminSessionService,
    private readonly authRepository: AuthRepository,
    private readonly audit: AdminAuditService,
    private readonly telegram: TelegramBotService,
    private readonly clock: ClockService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.botToken = config.get<string>('TELEGRAM_BOT_TOKEN');
  }

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

  async verify(input: VerifyTelegramLoginInput, meta: TokenMeta): Promise<AdminSignIn> {
    this.ensureEnabled();
    const { userId } = await this.login.redeem(input, 'ADMIN');
    const user = await this.authRepository.findUserById(userId);
    // Checked again here: the admin list may have changed since the bot sent the code.
    if (!user || !this.access.isAdmin(user.telegramId)) throw new NotFoundException();
    return this.openSession(user, meta, { device: describeDevice(meta.userAgent) });
  }

  /**
   * Sign-in from the bot's /admin button: the panel opens as a Mini App and Telegram's signature
   * on the launch data stands in for the code. Each launch opens one session, and only within
   * minutes of opening; anyone but an admin gets the same 404 as everywhere else in the panel.
   */
  async webApp(initData: string, meta: TokenMeta): Promise<AdminSignIn> {
    this.ensureEnabled();
    if (!this.botToken) {
      throw new DomainException('Telegram ilovasi vaqtincha ishlamayapti', 'TELEGRAM_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const result = validateInitData(initData, this.botToken, ADMIN_INIT_DATA_MAX_AGE_SECONDS);
    if (!result.ok && result.reason === 'invalid') {
      throw new UnauthorizedException({ code: 'TELEGRAM_INIT_DATA_INVALID', message: 'Telegram maʼlumotlari tasdiqlanmadi' });
    }
    // A reload, or launch data copied elsewhere, counts as stale: the owner reopens the panel.
    const firstUse =
      result.ok &&
      (await this.redis.setIfAbsent(`${ADMIN_WEBAPP_KEY}${result.hash}`, '1', ADMIN_INIT_DATA_MAX_AGE_SECONDS + 60));
    if (!result.ok || !firstUse) {
      throw new UnauthorizedException({ code: 'TELEGRAM_INIT_DATA_EXPIRED', message: 'Admin panelni botdagi /admin orqali qayta oching' });
    }

    const telegramId = BigInt(result.user.id);
    const user = await this.authRepository.findUserByTelegramId(telegramId);
    if (!user || !this.access.isAdmin(user.telegramId)) {
      await this.audit.record({
        action: 'LOGIN_DENIED',
        telegramId,
        ipAddress: meta.ipAddress,
        meta: {
          reason: this.access.isAdmin(telegramId) ? 'no_account' : 'not_admin',
          username: result.user.username ?? null,
          via: 'miniapp',
        },
      });
      throw new NotFoundException();
    }
    return this.openSession(user, meta, { device: describeDevice(meta.userAgent), via: 'miniapp' });
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

  private async openSession(user: User, meta: TokenMeta, details: Record<string, string>): Promise<AdminSignIn> {
    const { token, expiresAt } = await this.sessions.create(user.id, meta);
    await this.audit.record({
      action: 'LOGIN',
      adminUserId: user.id,
      telegramId: user.telegramId,
      ipAddress: meta.ipAddress,
      meta: details,
    });
    void this.notifySignIn(user, meta);
    return { token, session: { admin: toProfile(user), expiresAt: expiresAt.toISOString() } };
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
