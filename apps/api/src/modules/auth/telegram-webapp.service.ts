import { ForbiddenException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { AuthService, MiniAppAccess, TokenMeta } from './auth.service';
import { AuthRepository } from './auth.repository';
import { validateInitData } from './telegram-init-data';
import { DomainException } from '../../common/exceptions/domain.exception';
import { RedisService } from '../../infra/redis/redis.service';

/**
 * How long one Mini App launch stays signed in. The app re-exchanges the same initData whenever
 * its short-lived access token expires, so this is the real session length.
 */
export const INIT_DATA_MAX_AGE_SECONDS = 24 * 3600;

/** Signs a Telegram Mini App in with the initData Telegram signed for this launch. */
@Injectable()
export class TelegramWebAppService {
  private readonly botToken?: string;

  constructor(
    private readonly auth: AuthService,
    private readonly repository: AuthRepository,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.botToken = config.get<string>('TELEGRAM_BOT_TOKEN');
  }

  async exchange(initData: string, meta: TokenMeta): Promise<MiniAppAccess> {
    if (!this.botToken) {
      throw new DomainException('Telegram ilovasi vaqtincha ishlamayapti', 'TELEGRAM_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const result = validateInitData(initData, this.botToken, INIT_DATA_MAX_AGE_SECONDS);
    if (!result.ok) {
      throw new UnauthorizedException(
        result.reason === 'expired'
          ? { code: 'TELEGRAM_INIT_DATA_EXPIRED', message: 'Ilova sessiyasi eskirgan. Ilovani botdan qayta oching' }
          : { code: 'TELEGRAM_INIT_DATA_INVALID', message: 'Telegram maʼlumotlari tasdiqlanmadi' },
      );
    }

    const user = await this.repository.findUserByTelegramId(BigInt(result.user.id));
    if (!user) {
      throw new ForbiddenException({
        code: 'TELEGRAM_NOT_REGISTERED',
        message: 'Avval botda /start bosib, telefon raqamingizni ulashing',
      });
    }

    const familyId = await this.sessionFor(result.hash, result.authDate, user, meta);
    return this.auth.miniAppAccess(user, familyId);
  }

  /**
   * One session per launch: every launch gets fresh initData with its own hash, and re-exchanges
   * within a launch reuse the session instead of filling the sessions list. A launch whose
   * session was ended (logout everywhere) gets a new one: Telegram has just vouched for the user.
   */
  private async sessionFor(
    hash: string,
    authDate: number,
    user: User,
    meta: TokenMeta,
  ): Promise<string> {
    const key = `auth:webapp:${hash}`;
    const expiresAt = new Date((authDate + INIT_DATA_MAX_AGE_SECONDS) * 1000);
    const ttl = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    const existing = await this.redis.get(key);
    if (existing && (await this.repository.familyStatus(user.id, existing)) !== 'ended') return existing;

    const familyId = await this.auth.startMiniAppSession(user, meta, expiresAt);
    if (existing) {
      await this.redis.set(key, familyId, ttl);
      return familyId;
    }
    // Two requests of the same launch can race here (e.g. parallel 401 retries): keep one session.
    if (await this.redis.setIfAbsent(key, familyId, ttl)) return familyId;
    const winner = await this.redis.get(key);
    if (winner && winner !== familyId) {
      await this.repository.revokeUserFamily(user.id, familyId);
      return winner;
    }
    return familyId;
  }
}
