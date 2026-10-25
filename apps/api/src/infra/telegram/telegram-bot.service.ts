import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, InputFile } from 'grammy';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from 'grammy/types';
import { PrismaService } from '../prisma/prisma.service';

export type TelegramReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove;

export type SendResult = 'SENT' | 'BLOCKED' | 'FAILED' | 'DISABLED';

/**
 * Owns the single grammY `Bot` instance. Domain modules only send through here; update
 * handling and webhook/polling setup live in TelegramModule. Without TELEGRAM_BOT_TOKEN the bot
 * is disabled and every send is a no-op (local development without Telegram).
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  readonly bot: Bot | null;
  readonly username: string;
  private suspended = false;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const token = config.get<string>('TELEGRAM_BOT_TOKEN');
    this.username = config.get<string>('TELEGRAM_BOT_USERNAME') ?? 'fintrack_bot';
    const apiRoot = config.get<string>('TELEGRAM_API_ROOT');
    this.bot = token ? new Bot(token, { client: apiRoot ? { apiRoot } : undefined }) : null;
  }

  get enabled(): boolean {
    return this.bot !== null && !this.suspended;
  }

  /**
   * Switches the bot off in this process when another deployment owns the token: answering
   * sign-ins or sending digests from here would mix two databases in one chat.
   */
  suspend(): void {
    this.suspended = true;
  }

  /** `https://t.me/<bot>?start=<payload>`; payload must match [A-Za-z0-9_-]{1,64}. */
  deepLink(payload: string): string {
    return `https://t.me/${this.username}?start=${payload}`;
  }

  /**
   * Sends a message and never throws. A 403 means the user blocked the bot: remember it so
   * background jobs stop spamming a dead chat until the user writes to the bot again.
   */
  async send(
    chatId: number | bigint,
    text: string,
    options: { replyMarkup?: TelegramReplyMarkup; html?: boolean } = {},
  ): Promise<SendResult> {
    return this.deliver('sendMessage', chatId, (bot) =>
      bot.api.sendMessage(Number(chatId), text, {
        parse_mode: options.html ? 'HTML' : undefined,
        reply_markup: options.replyMarkup,
        link_preview_options: { is_disabled: true },
      }),
    );
  }

  /** A voice message (OGG/Opus), with the same never-throw and 403 handling as `send`. */
  async sendVoice(chatId: number | bigint, audio: Buffer, options: { caption?: string } = {}): Promise<SendResult> {
    return this.deliver('sendVoice', chatId, (bot) =>
      bot.api.sendVoice(Number(chatId), new InputFile(audio, 'voice.ogg'), { caption: options.caption }),
    );
  }

  private async deliver(method: string, chatId: number | bigint, call: (bot: Bot) => Promise<unknown>): Promise<SendResult> {
    if (!this.bot || this.suspended) return 'DISABLED';
    try {
      await call(this.bot);
      return 'SENT';
    } catch (err: unknown) {
      if (err instanceof GrammyError && err.error_code === 403) {
        await this.prisma.user
          .updateMany({ where: { telegramId: BigInt(chatId) }, data: { telegramBlockedAt: new Date() } })
          .catch(() => undefined);
        return 'BLOCKED';
      }
      // Retry-after and network errors are the outbox's concern; log without message content.
      this.logger.warn(`${method} failed: ${err instanceof GrammyError ? err.description : String(err)}`);
      return 'FAILED';
    }
  }
}
