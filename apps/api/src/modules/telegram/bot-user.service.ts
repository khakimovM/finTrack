import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { Context } from 'grammy';
import { AppLocale, errorText } from '@fintrack/shared';
import { AuthRepository } from '../auth/auth.repository';
import { TelegramLoginBotService } from '../auth/telegram-login-bot.service';
import { loginText } from '../auth/telegram-login.messages';
import { DomainException } from '../../common/exceptions/domain.exception';
import { BOT_TEXTS, botText } from './i18n';

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
    const banned = loginText(user.locale).banned;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: banned, show_alert: true });
    else await ctx.reply(banned);
    return true;
  }

  async resolve(ctx: Context): Promise<User | null> {
    if (!ctx.from || ctx.from.is_bot || ctx.chat?.type !== 'private') return null;
    const user = await this.auth.findUserByTelegramId(BigInt(ctx.from.id));
    if (!user) {
      // No account yet, so no language either: Telegram's own is the best guess.
      const text = botText(ctx.from.language_code).common.notRegistered;
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text, show_alert: true });
      else await ctx.reply(text);
      return null;
    }
    if (user.telegramBlockedAt) {
      // The user is talking to the bot again, so it is no longer blocked.
      await this.auth.touchTelegramProfile(user.id, ctx.from.username ?? null);
    }
    return user;
  }
}

/**
 * What to tell the chat about a failed action. Domain errors carry an Uzbek message, often more
 * specific than the code's general text, so Uzbek keeps it; Russian takes the code's text.
 */
export function chatErrorMessage(err: unknown, locale: AppLocale): string {
  const fallback = BOT_TEXTS[locale].common.genericError;
  if (err instanceof DomainException) return locale === 'uz' ? err.message : (errorText(locale, err.code) ?? fallback);
  const response = (err as { getResponse?: () => unknown }).getResponse?.();
  if (response && typeof response === 'object' && typeof (response as { message?: unknown }).message === 'string') {
    const { message, code } = response as { message: string; code?: string };
    return locale === 'uz' ? message : (errorText(locale, code) ?? fallback);
  }
  return fallback;
}
