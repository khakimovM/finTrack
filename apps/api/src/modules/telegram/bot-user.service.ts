import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { Context } from 'grammy';
import { AuthRepository } from '../auth/auth.repository';
import { TelegramLoginBotService } from '../auth/telegram-login-bot.service';
import { LOGIN_TEXT } from '../auth/telegram-login.messages';
import { DomainException } from '../../common/exceptions/domain.exception';
import { TEXT } from './bot-ui';

/**
 * Maps a Telegram sender to the FinTrack account. This is the bot's authentication: every
 * handler acts as the user returned here, and domain services scope every query by that id.
 */
@Injectable()
export class BotUserService {
  constructor(
    private readonly auth: AuthRepository,
    private readonly loginBot: TelegramLoginBotService,
  ) {}

  /**
   * A banned account gets the same answer to everything it sends. Runs before every handler, so
   * no sign-in, registration or entry goes through. Returns true when the update was refused.
   */
  async refuseBanned(ctx: Context): Promise<boolean> {
    if (!ctx.from || ctx.from.is_bot || ctx.chat?.type !== 'private') return false;
    const user = await this.auth.findUserByTelegramId(BigInt(ctx.from.id));
    if (!user?.bannedAt) return false;

    const payload = /^\/start\s+(\S+)/.exec(ctx.message?.text ?? '')?.[1];
    if (payload) await this.loginBot.cancelForBanned(payload);
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: LOGIN_TEXT.banned, show_alert: true });
    else await ctx.reply(LOGIN_TEXT.banned);
    return true;
  }

  async resolve(ctx: Context): Promise<User | null> {
    if (!ctx.from || ctx.from.is_bot || ctx.chat?.type !== 'private') return null;
    const user = await this.auth.findUserByTelegramId(BigInt(ctx.from.id));
    if (!user) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: TEXT.notRegistered, show_alert: true });
      else await ctx.reply(TEXT.notRegistered);
      return null;
    }
    if (user.telegramBlockedAt) {
      // The user is talking to the bot again, so it is no longer blocked.
      await this.auth.touchTelegramProfile(user.id, ctx.from.username ?? null);
    }
    return user;
  }
}

/** Domain errors already carry an Uzbek message suitable for the chat. */
export function chatErrorMessage(err: unknown): string {
  if (err instanceof DomainException) return err.message;
  const response = (err as { getResponse?: () => unknown }).getResponse?.();
  if (response && typeof response === 'object' && typeof (response as { message?: unknown }).message === 'string') {
    return (response as { message: string }).message;
  }
  return TEXT.genericError;
}
