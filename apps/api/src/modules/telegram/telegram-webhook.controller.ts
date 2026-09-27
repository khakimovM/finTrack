import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { BotError } from 'grammy';
import type { Update } from 'grammy/types';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { TelegramLifecycleService } from './telegram-lifecycle.service';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Telegram → API. Authenticated by the secret token Telegram echoes on every call; anything else
 * gets the same 404 as an unknown route so the endpoint cannot be probed.
 */
@ApiExcludeController()
@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly telegram: TelegramBotService,
    private readonly lifecycle: TelegramLifecycleService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handle(
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: Update,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    const bot = this.telegram.bot;
    if (!bot || !expected || !secretHeader || !safeEqual(secretHeader, expected)) {
      throw new NotFoundDomainException();
    }

    try {
      await bot.handleUpdate(update);
    } catch (err: unknown) {
      // Answer 200 anyway: a failing update must not be redelivered forever.
      if (err instanceof BotError) this.lifecycle.logError(err);
    }
    return { ok: true };
  }
}
