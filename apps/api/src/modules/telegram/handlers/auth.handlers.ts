import { Injectable } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import { TelegramFrom, TelegramLoginBotService } from '../../auth/telegram-login-bot.service';
import { LOGIN_TEXT } from '../../auth/telegram-login.messages';

export function toFrom(ctx: Context): TelegramFrom | null {
  const from = ctx.from;
  if (!from || from.is_bot) return null;
  return {
    id: from.id,
    firstName: from.first_name,
    lastName: from.last_name,
    username: from.username,
    languageCode: from.language_code,
  };
}

/** /start (with login_/link_ payloads), shared contacts and the "not me" button. */
@Injectable()
export class AuthHandlers {
  constructor(private readonly loginBot: TelegramLoginBotService) {}

  register(bot: Bot): void {
    // Finance data is never discussed in groups: the bot only talks in private chats.
    const pm = bot.chatType('private');

    pm.command('start', async (ctx) => {
      const from = toFrom(ctx);
      if (!from) return;
      const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
      if (payload && (await this.loginBot.handleStartPayload(payload, from))) return;

      const user = await this.loginBot.handlePlainStart(from);
      if (user) {
        await ctx.reply(LOGIN_TEXT.welcomeBack(user.name), { parse_mode: 'HTML' });
      }
    });

    pm.on('message:contact', async (ctx) => {
      const from = toFrom(ctx);
      if (!from) return;
      await this.loginBot.handleContact(from, {
        userId: ctx.message.contact.user_id,
        phoneNumber: ctx.message.contact.phone_number,
      });
    });

    bot.callbackQuery(/^login_cancel:([0-9a-f-]{36})$/, async (ctx) => {
      await this.loginBot.handleCancel(ctx.match[1], ctx.from.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
    });
  }
}
