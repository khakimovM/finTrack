import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramLoginRequest } from '@prisma/client';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto';
import { TelegramLoginRepository } from './telegram-login.repository';
import { LOGIN_TEXT, describeDevice } from './telegram-login.messages';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { RedisService } from '../../infra/redis/redis.service';

export const CODE_TTL_MS = 3 * 60_000;
export const MAX_CODES_PER_WINDOW = 5;
const CODE_WINDOW_SECONDS = 15 * 60;

export type SendCodeResult = 'SENT' | 'RATE_LIMITED' | 'UNDELIVERED';

/** Generates, stores (hashed) and delivers the six-digit sign-in codes. */
@Injectable()
export class LoginCodeService {
  private readonly key: Buffer;

  constructor(
    config: ConfigService,
    private readonly repository: TelegramLoginRepository,
    private readonly telegram: TelegramBotService,
    private readonly redis: RedisService,
  ) {
    // Production requires OTP_SECRET (env validation); development derives a stable key.
    const secret =
      config.get<string>('OTP_SECRET') ?? `otp:${config.get<string>('JWT_ACCESS_SECRET', '')}`;
    this.key = createHash('sha256').update(secret).digest();
  }

  hash(requestId: string, code: string): string {
    return createHmac('sha256', this.key).update(`${requestId}:${code}`).digest('hex');
  }

  matches(request: TelegramLoginRequest, code: string): boolean {
    if (!request.codeHash) return false;
    const expected = Buffer.from(request.codeHash, 'hex');
    const actual = Buffer.from(this.hash(request.id, code), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /**
   * Issues a fresh code for `request` to Telegram user `telegramId` (whose account is `userId`).
   * Any previous code of the request stops working.
   */
  async issue(request: TelegramLoginRequest, telegramId: bigint, userId: string): Promise<SendCodeResult> {
    const sentRecently = await this.redis.incrWithTtl(`tg:codes:${telegramId}`, CODE_WINDOW_SECONDS);
    if (sentRecently !== null && sentRecently > MAX_CODES_PER_WINDOW) {
      await this.telegram.send(telegramId, LOGIN_TEXT.tooManyCodes, { html: true });
      return 'RATE_LIMITED';
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.repository.update(request.id, {
      status: 'CODE_SENT',
      userId,
      telegramId,
      codeHash: this.hash(request.id, code),
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      attempts: 0,
      codesSent: request.codesSent + 1,
    });

    const result = await this.telegram.send(
      telegramId,
      LOGIN_TEXT.code(code, describeDevice(request.userAgent), request.ipAddress),
      {
        html: true,
        replyMarkup: {
          inline_keyboard: [[{ text: LOGIN_TEXT.cancelButton, callback_data: `login_cancel:${request.id}` }]],
        },
      },
    );
    return result === 'SENT' || result === 'DISABLED' ? 'SENT' : 'UNDELIVERED';
  }
}
