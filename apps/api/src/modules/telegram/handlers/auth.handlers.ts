import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { TelegramFrom, TelegramLoginBotService } from '../../auth/telegram-login-bot.service';
import { LOGIN_TEXT } from '../../auth/telegram-login.messages';
import { AdminAccessService } from '../../admin/core/admin-access.service';
import { ADMIN_TEXT, adminPanelUrl, openAdminKeyboard } from '../bot-ui';
import { MenuHandlers } from './menu.handlers';

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

/** /start (with login_/link_/admin_ payloads), /id, /admin, shared contacts and the "not me" button. */
@Injectable()
export class AuthHandlers {
  private readonly siteUrl?: string;

  constructor(
    private readonly loginBot: TelegramLoginBotService,
    private readonly menu: MenuHandlers,
    private readonly adminAccess: AdminAccessService,
    config: ConfigService,
  ) {
    this.siteUrl = config.get<string>('WEB_APP_URL') ?? config.get<string>('CLIENT_URL');
  }

  register(bot: Bot): void {
    // Finance data is never discussed in groups: the bot only talks in private chats.
    const pm = bot.chatType('private');

    pm.command('start', async (ctx) => {
      const from = toFrom(ctx);
      if (!from) return;
      const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
      if (payload && (await this.loginBot.handleStartPayload(payload, from))) return;

      const user = await this.loginBot.handlePlainStart(from);
      if (user) await this.menu.sendMenu(ctx, LOGIN_TEXT.welcomeBack(user.name));
    });

    // Anyone's own Telegram id, e.g. to put it in ADMIN_TELEGRAM_IDS. Not in the command menu.
    pm.command('id', async (ctx) => {
      const from = toFrom(ctx);
      if (!from) return;
      await ctx.reply(LOGIN_TEXT.yourId(from.id), { parse_mode: 'HTML' });
    });

    // The owner's way into the admin panel. Anyone else gets what any unknown command gets:
    // silence, so the bot does not reveal that a panel exists.
    pm.command('admin', async (ctx) => {
      const from = toFrom(ctx);
      if (!from || !this.adminAccess.isAdmin(BigInt(from.id))) return;
      const url = adminPanelUrl(this.siteUrl);
      if (!url) {
        await ctx.reply(ADMIN_TEXT.noHttps(this.siteUrl?.replace(/\/+$/, '') ?? ''));
        return;
      }
      await ctx.reply(ADMIN_TEXT.open, { parse_mode: 'HTML', reply_markup: openAdminKeyboard(url) });
    });

    pm.on('message:contact', async (ctx) => {
      const from = toFrom(ctx);
      if (!from) return;
      const user = await this.loginBot.handleContact(from, {
        userId: ctx.message.contact.user_id,
        phoneNumber: ctx.message.contact.phone_number,
      });
      if (user) await this.menu.sendMenu(ctx);
    });

    bot.callbackQuery(/^login_cancel:([0-9a-f-]{36})$/, async (ctx) => {
      await this.loginBot.handleCancel(ctx.match[1], ctx.from.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
    });
  }
}
