import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { TelegramLoginPurpose, TelegramLoginRequest, TelegramLoginStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import {
  TelegramLoginStartResponse,
  TelegramLoginStatusResponse,
  VerifyTelegramLoginInput,
} from '@fintrack/shared';
import { TelegramLoginRepository } from './telegram-login.repository';
import { LoginCodeService } from './login-code.service';
import { AuthRepository } from './auth.repository';
import { AuthResult, AuthService, TokenMeta } from './auth.service';
import { LOGIN_TEXT, describeDevice } from './telegram-login.messages';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ClockService } from '../../infra/clock/clock.service';
import { DomainException, NotFoundDomainException } from '../../common/exceptions/domain.exception';

export const REQUEST_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
export const MAX_CODES_PER_REQUEST = 3;
const OPEN_STATUSES: TelegramLoginStatus[] = ['PENDING', 'AWAITING_CONTACT', 'CODE_SENT'];

export function hashNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

type VerifyOutcome =
  | { ok: true; userId: string; request: TelegramLoginRequest }
  | { ok: false; error: DomainException };

@Injectable()
export class TelegramLoginService {
  private readonly logger = new Logger(TelegramLoginService.name);

  constructor(
    private readonly repository: TelegramLoginRepository,
    private readonly codes: LoginCodeService,
    private readonly authRepository: AuthRepository,
    private readonly authService: AuthService,
    private readonly telegram: TelegramBotService,
    private readonly clock: ClockService,
    private readonly prisma: PrismaService,
  ) {}

  /** Opens a sign-in (or, for a signed-in user, a link) request and returns the bot deep link. */
  async start(
    meta: TokenMeta,
    purpose: TelegramLoginPurpose = 'LOGIN',
    userId?: string,
  ): Promise<TelegramLoginStartResponse> {
    if (!this.telegram.enabled) {
      throw new DomainException(
        'Telegram orqali kirish vaqtincha ishlamayapti',
        'TELEGRAM_UNAVAILABLE',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    // 24 random bytes → 32 base64url chars; Telegram start payloads allow [A-Za-z0-9_-]{1,64}.
    const nonce = randomBytes(24).toString('base64url');
    const request = await this.repository.create({
      purpose,
      nonceHash: hashNonce(nonce),
      userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent?.slice(0, 300),
      expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
    });

    const prefix = purpose === 'LOGIN' ? 'login' : 'link';
    return {
      requestId: request.id,
      deepLink: this.telegram.deepLink(`${prefix}_${nonce}`),
      botUsername: this.telegram.username,
      expiresAt: request.expiresAt.toISOString(),
    };
  }

  async status(requestId: string): Promise<TelegramLoginStatusResponse> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new NotFoundDomainException('So‘rov topilmadi');

    const expired = OPEN_STATUSES.includes(request.status) && request.expiresAt < new Date();
    return {
      status: expired ? 'EXPIRED' : request.status,
      expiresAt: request.expiresAt.toISOString(),
      codeExpiresAt: request.codeExpiresAt?.toISOString() ?? null,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - request.attempts),
    };
  }

  /**
   * Redeems the code. The request row is locked, so parallel guesses queue up; a wrong guess is
   * committed (attempt counted) before the error is thrown.
   */
  async verify(input: VerifyTelegramLoginInput, meta: TokenMeta): Promise<AuthResult> {
    const outcome = await this.prisma.$transaction(async (db): Promise<VerifyOutcome> => {
      const request = await this.repository.lock(db, input.requestId);
      if (!request || request.purpose !== 'LOGIN') {
        return { ok: false, error: new NotFoundDomainException('So‘rov topilmadi') };
      }
      const now = new Date();
      if (
        request.status !== 'CODE_SENT' ||
        !request.userId ||
        request.expiresAt < now ||
        !request.codeExpiresAt ||
        request.codeExpiresAt < now
      ) {
        return { ok: false, error: this.expiredError() };
      }

      if (this.codes.matches(request, input.code)) {
        await this.repository.update(request.id, { status: 'CONSUMED', consumedAt: now, codeHash: null }, db);
        return { ok: true, userId: request.userId, request };
      }

      const attempts = request.attempts + 1;
      await this.repository.update(
        request.id,
        { attempts, ...(attempts >= MAX_ATTEMPTS ? { status: 'EXPIRED', codeHash: null } : {}) },
        db,
      );
      return {
        ok: false,
        error:
          attempts >= MAX_ATTEMPTS
            ? new DomainException(
                'Urinishlar soni tugadi. Qaytadan kiring',
                'OTP_ATTEMPTS_EXCEEDED',
                HttpStatus.TOO_MANY_REQUESTS,
              )
            : new DomainException('Kod noto‘g‘ri', 'OTP_INVALID', HttpStatus.BAD_REQUEST, {
                attemptsLeft: MAX_ATTEMPTS - attempts,
              }),
      };
    });

    if (!outcome.ok) throw outcome.error;

    const user = await this.authRepository.findUserById(outcome.userId);
    if (!user) throw new NotFoundDomainException('Foydalanuvchi topilmadi');

    const session = await this.authService.issueSession(user, meta);
    void this.notifyNewLogin(user.telegramId, meta, user.timezone);
    return session;
  }

  async resend(requestId: string): Promise<TelegramLoginStatusResponse> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new NotFoundDomainException('So‘rov topilmadi');
    if (request.status !== 'CODE_SENT' || !request.telegramId || !request.userId || request.expiresAt < new Date()) {
      throw this.expiredError();
    }
    if (request.codesSent >= MAX_CODES_PER_REQUEST) {
      throw new DomainException(
        'Kod juda ko‘p marta so‘raldi. Qaytadan kiring',
        'OTP_RESEND_LIMIT',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.codes.issue(request, request.telegramId, request.userId);
    if (result === 'RATE_LIMITED') {
      throw new DomainException('Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring', 'RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.status(requestId);
  }

  private expiredError(): DomainException {
    return new DomainException(
      'Kodning muddati tugagan yoki u ishlatilgan. Qaytadan kiring',
      'OTP_EXPIRED',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  /** Security notice in the bot; best effort, never blocks the sign-in response. */
  private async notifyNewLogin(telegramId: bigint | null, meta: TokenMeta, timezone: string): Promise<void> {
    if (telegramId === null) return;
    try {
      const time = new Intl.DateTimeFormat('uz-UZ', {
        timeZone: timezone,
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(this.clock.now());
      await this.telegram.send(telegramId, LOGIN_TEXT.newLogin(describeDevice(meta.userAgent), meta.ipAddress ?? null, time), {
        html: true,
      });
    } catch (err) {
      this.logger.warn(`New-login notice failed: ${String(err)}`);
    }
  }
}
