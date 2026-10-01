import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { User } from '@prisma/client';
import { BotUserService, chatErrorMessage } from '../bot-user.service';
import { BotReportsService, ReportPeriod } from '../bot-reports.service';
import { DraftStore } from '../drafts/draft.store';
import { MENU, TEXT, mainMenu, miniAppUrl, openAppKeyboard } from '../bot-ui';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../../auth/auth.service';

const REPORT_KEYBOARD = (active: ReportPeriod): InlineKeyboardMarkup => ({
  inline_keyboard: [
    (['today', 'week', 'month'] as const).map((p) => ({
      text: `${p === active ? '• ' : ''}${{ today: 'Bugun', week: 'Hafta', month: 'Oy' }[p]}`,
      callback_data: `r:${p}`,
    })),
  ],
});

function settingsKeyboard(user: User): InlineKeyboardMarkup {
  const mark = (on: boolean) => (on ? '✅' : '⬜️');
  return {
    inline_keyboard: [
      [{ text: `${mark(user.strictMode)} Qatʼiy rejim`, callback_data: 'set:strict' }],
      [{ text: `${mark(user.notifyTelegram)} Bildirishnomalar`, callback_data: 'set:notify' }],
      [{ text: `${mark(user.dailyDigest)} Kunlik xulosa (21:00)`, callback_data: 'set:digest' }],
      [{ text: '🚪 Barcha qurilmalardan chiqish', callback_data: 'set:logoutall' }],
    ],
  };
}

const SETTINGS_TEXT =
  '⚙️ <b>Sozlamalar</b>\n\n' +
  '<b>Qatʼiy rejim</b> — balansdan ortiq xarajat yozishga ruxsat bermaydi.\n' +
  '<b>Bildirishnomalar</b> — byudjet, qarz va takroriy to‘lov ogohlantirishlari.\n' +
  '<b>Kunlik xulosa</b> — har kuni kechqurun bugungi kirim-chiqim.';

@Injectable()
export class MenuHandlers {
  private readonly webAppUrl?: string;

  constructor(
    private readonly users: BotUserService,
    private readonly reports: BotReportsService,
    private readonly drafts: DraftStore,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL') ?? config.get<string>('CLIENT_URL');
  }

  /** The main keyboard with the usage hint, sent after /start and /menu. */
  async sendMenu(ctx: Context, greeting?: string): Promise<void> {
    await ctx.reply(`${greeting ? `${greeting}\n\n` : ''}${TEXT.menuIntro}`, {
      parse_mode: 'HTML',
      reply_markup: mainMenu(this.webAppUrl),
    });
  }

  register(bot: Bot): void {
    const pm = bot.chatType('private');
    const withUser = (run: (ctx: Context, user: User) => Promise<unknown>) => async (ctx: Context) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      try {
        await run(ctx, user);
      } catch (err) {
        await ctx.reply(chatErrorMessage(err));
      }
    };
    const html = (ctx: Context, text: string, reply_markup?: InlineKeyboardMarkup) =>
      ctx.reply(text, { parse_mode: 'HTML', reply_markup });

    pm.command('menu', withUser((ctx) => this.sendMenu(ctx)));
    pm.command('balans', withUser(async (ctx, user) => html(ctx, await this.reports.balance(user))));

    pm.hears(MENU.expense, withUser(async (ctx) => this.askEntry(ctx, 'EXPENSE')));
    pm.hears(MENU.income, withUser(async (ctx) => this.askEntry(ctx, 'INCOME')));
    pm.hears(MENU.balance, withUser(async (ctx, user) => html(ctx, await this.reports.balance(user))));
    pm.hears(MENU.recent, withUser(async (ctx, user) => html(ctx, await this.reports.recent(user))));
    pm.hears(MENU.budgets, withUser(async (ctx, user) => html(ctx, await this.reports.budgetsStatus(user))));
    pm.hears(
      MENU.report,
      withUser(async (ctx, user) => html(ctx, await this.reports.report(user, 'month'), REPORT_KEYBOARD('month'))),
    );
    pm.hears(MENU.settings, withUser(async (ctx, user) => html(ctx, SETTINGS_TEXT, settingsKeyboard(user))));
    pm.hears(
      MENU.app,
      withUser(async (ctx) => {
        const url = miniAppUrl(this.webAppUrl);
        if (!url) return ctx.reply('Ilova hozircha faqat saytda ochiladi.');
        return ctx.reply('Hisoblar, grafiklar va hisobotlar — to‘liq ilovada 👇', { reply_markup: openAppKeyboard(url) });
      }),
    );

    bot.callbackQuery(/^r:(today|week|month)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const period = ctx.match[1] as ReportPeriod;
      await ctx.answerCallbackQuery();
      await ctx
        .editMessageText(await this.reports.report(user, period), {
          parse_mode: 'HTML',
          reply_markup: REPORT_KEYBOARD(period),
        })
        .catch(() => undefined); // "message is not modified" when tapping the active period
    });

    bot.callbackQuery(/^set:(strict|notify|digest|logoutall)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      try {
        if (ctx.match[1] === 'logoutall') {
          await this.authService.logoutAll(user.id);
          await ctx.answerCallbackQuery({ text: 'Barcha qurilmalardagi sessiyalar yakunlandi', show_alert: true });
          return;
        }
        const field = { strict: 'strictMode', notify: 'notifyTelegram', digest: 'dailyDigest' } as const;
        const key = field[ctx.match[1] as keyof typeof field];
        await this.usersService.updateProfile(user.id, { [key]: !user[key] });
        await ctx.answerCallbackQuery({ text: 'Saqlandi' });
        await ctx.editMessageReplyMarkup({ reply_markup: settingsKeyboard({ ...user, [key]: !user[key] }) });
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err), show_alert: true });
      }
    });
  }

  private async askEntry(ctx: Context, type: 'INCOME' | 'EXPENSE'): Promise<void> {
    if (!ctx.from) return;
    await this.drafts.setAwaiting(ctx.from.id, { kind: 'entry', type });
    await ctx.reply(TEXT.askEntry(type), { parse_mode: 'HTML' });
  }
}
