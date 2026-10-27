import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { User } from '@prisma/client';
import { APP_LOCALES, AppLocale } from '@fintrack/shared';
import { BotUserService, chatErrorMessage } from '../bot-user.service';
import { BotReportsService, ReportPeriod } from '../bot-reports.service';
import { DraftStore } from '../drafts/draft.store';
import { mainMenu, miniAppUrl, openAppKeyboard } from '../bot-ui';
import { BOT_TEXTS, LANGUAGE_NAMES, menuLabels, userLocale } from '../i18n';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../../auth/auth.service';
import { reminderKeyboard } from '../outbox/reminder-texts';

const REPORT_KEYBOARD = (active: ReportPeriod, locale: AppLocale): InlineKeyboardMarkup => ({
  inline_keyboard: [
    (['today', 'week', 'month'] as const).map((p) => ({
      text: `${p === active ? '• ' : ''}${BOT_TEXTS[locale].reports.periodButton[p]}`,
      callback_data: `r:${p}`,
    })),
  ],
});

function settingsKeyboard(user: User): InlineKeyboardMarkup {
  const locale = userLocale(user);
  const t = BOT_TEXTS[locale].settings;
  const mark = (on: boolean) => (on ? '✅' : '⬜️');
  return {
    inline_keyboard: [
      [{ text: `${mark(user.strictMode)} ${t.strict}`, callback_data: 'set:strict' }],
      [{ text: `${mark(user.notifyTelegram)} ${t.notify}`, callback_data: 'set:notify' }],
      [{ text: `${mark(user.dailyReminders)} ${t.reminders}`, callback_data: 'set:reminders' }],
      [{ text: `${mark(user.dailyDigest)} ${t.digest}`, callback_data: 'set:digest' }],
      [{ text: `${mark(user.monthlyReport)} ${t.monthly}`, callback_data: 'set:monthly' }],
      // Each language in its own words, so it can be found by someone who cannot read the other.
      APP_LOCALES.map((l) => ({ text: `${l === locale ? '✅' : '🌐'} ${LANGUAGE_NAMES[l]}`, callback_data: `lang:${l}` })),
      [{ text: t.logoutAll, callback_data: 'set:logoutall' }],
    ],
  };
}

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
  async sendMenu(ctx: Context, locale: AppLocale, greeting?: string): Promise<void> {
    await ctx.reply(`${greeting ? `${greeting}\n\n` : ''}${BOT_TEXTS[locale].common.menuIntro}`, {
      parse_mode: 'HTML',
      reply_markup: mainMenu(locale, this.webAppUrl),
    });
    if (locale !== 'uz') await this.renameMenuButton(ctx, locale);
  }

  register(bot: Bot): void {
    const pm = bot.chatType('private');
    const withUser = (run: (ctx: Context, user: User) => Promise<unknown>) => async (ctx: Context) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      try {
        await run(ctx, user);
      } catch (err) {
        await ctx.reply(chatErrorMessage(err, userLocale(user)));
      }
    };
    const html = (ctx: Context, text: string, reply_markup?: InlineKeyboardMarkup) =>
      ctx.reply(text, { parse_mode: 'HTML', reply_markup });

    pm.command('menu', withUser((ctx, user) => this.sendMenu(ctx, userLocale(user))));
    pm.command('balans', withUser(async (ctx, user) => html(ctx, await this.reports.balance(user))));

    pm.hears(menuLabels('expense'), withUser(async (ctx, user) => this.askEntry(ctx, 'EXPENSE', user)));
    pm.hears(menuLabels('income'), withUser(async (ctx, user) => this.askEntry(ctx, 'INCOME', user)));
    pm.hears(menuLabels('balance'), withUser(async (ctx, user) => html(ctx, await this.reports.balance(user))));
    pm.hears(menuLabels('recent'), withUser(async (ctx, user) => html(ctx, await this.reports.recent(user))));
    pm.hears(menuLabels('budgets'), withUser(async (ctx, user) => html(ctx, await this.reports.budgetsStatus(user))));
    pm.hears(
      menuLabels('report'),
      withUser(async (ctx, user) =>
        html(ctx, await this.reports.report(user, 'month'), REPORT_KEYBOARD('month', userLocale(user))),
      ),
    );
    pm.hears(
      menuLabels('settings'),
      withUser(async (ctx, user) => html(ctx, BOT_TEXTS[userLocale(user)].settings.text, settingsKeyboard(user))),
    );
    pm.hears(
      menuLabels('app'),
      withUser(async (ctx, user) => {
        const locale = userLocale(user);
        const url = miniAppUrl(this.webAppUrl);
        if (!url) return ctx.reply(BOT_TEXTS[locale].common.appOnlyOnSite);
        return ctx.reply(BOT_TEXTS[locale].common.appHint, { reply_markup: openAppKeyboard(locale, url) });
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
          reply_markup: REPORT_KEYBOARD(period, userLocale(user)),
        })
        .catch(() => undefined); // "message is not modified" when tapping the active period
    });

    // Buttons under the 07:00 and 22:00 reminders.
    bot.callbackQuery(/^rem:(expense|income)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      await ctx.answerCallbackQuery();
      await this.askEntry(ctx, ctx.match[1] === 'income' ? 'INCOME' : 'EXPENSE', user);
    });

    bot.callbackQuery('rem:off', async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const locale = userLocale(user);
      try {
        await this.usersService.updateProfile(user.id, { dailyReminders: false });
        await ctx.answerCallbackQuery({ text: BOT_TEXTS[locale].settings.remindersOff, show_alert: true });
        await ctx.editMessageReplyMarkup({ reply_markup: reminderKeyboard(locale, false) }).catch(() => undefined);
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err, locale), show_alert: true });
      }
    });

    bot.callbackQuery(/^set:(strict|notify|digest|reminders|monthly|logoutall)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const t = BOT_TEXTS[userLocale(user)].settings;
      try {
        if (ctx.match[1] === 'logoutall') {
          await this.authService.logoutAll(user.id);
          await ctx.answerCallbackQuery({ text: t.loggedOutAll, show_alert: true });
          return;
        }
        const field = {
          strict: 'strictMode',
          notify: 'notifyTelegram',
          digest: 'dailyDigest',
          reminders: 'dailyReminders',
          monthly: 'monthlyReport',
        } as const;
        const key = field[ctx.match[1] as keyof typeof field];
        await this.usersService.updateProfile(user.id, { [key]: !user[key] });
        await ctx.answerCallbackQuery({ text: t.savedToast });
        await ctx.editMessageReplyMarkup({ reply_markup: settingsKeyboard({ ...user, [key]: !user[key] }) });
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err, userLocale(user)), show_alert: true });
      }
    });

    // The account's language: the bot, the website and the Mini App all follow it.
    bot.callbackQuery(/^lang:(uz|ru)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const locale = ctx.match[1] as AppLocale;
      try {
        if (locale === userLocale(user)) return void (await ctx.answerCallbackQuery());
        await this.usersService.updateProfile(user.id, { locale });
        const changed = { ...user, locale };
        const t = BOT_TEXTS[locale];
        await ctx.answerCallbackQuery({ text: t.settings.savedToast });
        await ctx
          .editMessageText(t.settings.text, { parse_mode: 'HTML', reply_markup: settingsKeyboard(changed) })
          .catch(() => undefined);
        // Telegram replaces a reply keyboard only together with a new message.
        await ctx.reply(t.settings.languageChanged, { reply_markup: mainMenu(locale, this.webAppUrl) });
        await this.renameMenuButton(ctx, locale);
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err, userLocale(user)), show_alert: true });
      }
    });
  }

  /** The Mini App button by the input field has the bot-wide (Uzbek) name unless set per chat. */
  private async renameMenuButton(ctx: Context, locale: AppLocale): Promise<void> {
    const url = miniAppUrl(this.webAppUrl);
    if (!url || !ctx.chat) return;
    await ctx.api
      .setChatMenuButton({
        chat_id: ctx.chat.id,
        menu_button: { type: 'web_app', text: BOT_TEXTS[locale].menuButton, web_app: { url } },
      })
      .catch(() => undefined);
  }

  private async askEntry(ctx: Context, type: 'INCOME' | 'EXPENSE', user: User): Promise<void> {
    if (!ctx.from) return;
    await this.drafts.setAwaiting(ctx.from.id, { kind: 'entry', type });
    await ctx.reply(BOT_TEXTS[userLocale(user)].common.askEntry(type), { parse_mode: 'HTML' });
  }
}
