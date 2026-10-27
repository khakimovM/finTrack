import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotError, GrammyError } from 'grammy';
import { AppLocale } from '@fintrack/shared';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { AuthHandlers } from './handlers/auth.handlers';
import { MenuHandlers } from './handlers/menu.handlers';
import { DebtHandlers } from './handlers/debt.handlers';
import { EntryHandlers } from './handlers/entry.handlers';
import { VoiceHandlers } from './handlers/voice.handlers';
import { ADMIN_COMMANDS, miniAppUrl } from './bot-ui';
import { BOT_TEXTS } from './i18n';
import { ActivityService } from '../activity/activity.service';
import { BotUserService } from './bot-user.service';
import { AdminAccessService } from '../admin/core/admin-access.service';

export const ALLOWED_UPDATES = ['message', 'callback_query'] as const;

function commands(locale: AppLocale) {
  return Object.entries(BOT_TEXTS[locale].commands).map(([command, description]) => ({ command, description }));
}

/** Telegram picks the profile text by the user's app language; Uzbek is the default for the rest. */
const PROFILE_LANGUAGES: Array<{ locale: AppLocale; languageCode?: 'ru' }> = [
  { locale: 'uz' },
  { locale: 'ru', languageCode: 'ru' },
];
const forLanguage = (languageCode?: 'ru') => (languageCode ? { language_code: languageCode } : undefined);

/**
 * Wires handlers into the bot and chooses the transport: webhook when TELEGRAM_WEBHOOK_URL is
 * set (production), long polling otherwise (local development), neither in tests (updates are
 * injected through the webhook controller). Polling never starts on a token that already has a
 * webhook.
 */
@Injectable()
export class TelegramLifecycleService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramLifecycleService.name);
  private polling = false;

  constructor(
    private readonly telegram: TelegramBotService,
    private readonly config: ConfigService,
    private readonly authHandlers: AuthHandlers,
    private readonly menuHandlers: MenuHandlers,
    private readonly debtHandlers: DebtHandlers,
    private readonly entryHandlers: EntryHandlers,
    private readonly voiceHandlers: VoiceHandlers,
    private readonly activity: ActivityService,
    private readonly botUsers: BotUserService,
    private readonly adminAccess: AdminAccessService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const bot = this.telegram.bot;
    if (!bot) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set: Telegram sign-in and the bot are disabled');
      return;
    }

    // A banned account is answered before anything else runs, and its tries are not activity.
    bot.use(async (ctx, next) => {
      if (!(await this.botUsers.refuseBanned(ctx))) await next();
    });
    // Every private message or button tap counts as using FinTrack through the bot. Recorded after
    // the handlers, so the contact that registers a new user already counts for them.
    bot.use(async (ctx, next) => {
      await next();
      if (ctx.from && !ctx.from.is_bot && ctx.chat?.type === 'private') await this.activity.touchTelegram(BigInt(ctx.from.id));
    });
    // Order matters: specific commands/buttons first, free-text entry parsing last.
    this.authHandlers.register(bot);
    this.menuHandlers.register(bot);
    this.debtHandlers.register(bot);
    this.entryHandlers.register(bot);
    this.voiceHandlers.register(bot);
    this.entryHandlers.registerTextFallback(bot);
    bot.catch((err: BotError) => this.logError(err));

    try {
      await bot.init();
    } catch (err: unknown) {
      this.logger.error(`Telegram getMe failed, bot stays offline: ${this.describe(err)}`);
      return;
    }

    const env = this.config.get<string>('NODE_ENV');
    if (env === 'test') return;

    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
    try {
      if (!webhookUrl && (await this.webhookOwnedElsewhere(bot))) return;
      for (const { locale, languageCode } of PROFILE_LANGUAGES) {
        await bot.api.setMyCommands(commands(locale), forLanguage(languageCode));
      }
      await this.showAdminCommand(bot);
      // The menu button next to the input field opens the Mini App with signed initData.
      const siteUrl = this.config.get<string>('WEB_APP_URL') ?? this.config.get<string>('CLIENT_URL');
      const appUrl = miniAppUrl(siteUrl);
      await bot.api.setChatMenuButton({
        menu_button: appUrl ? { type: 'web_app', text: BOT_TEXTS.uz.menuButton, web_app: { url: appUrl } } : { type: 'commands' },
      });
      // The bot's profile and its t.me page (which search engines index) name the website.
      if (appUrl && siteUrl) {
        const host = new URL(siteUrl).host;
        for (const { locale, languageCode } of PROFILE_LANGUAGES) {
          const profile = BOT_TEXTS[locale].profile;
          await bot.api.setMyShortDescription(profile.short(host), forLanguage(languageCode));
          await bot.api.setMyDescription(profile.long(`https://${host}`), forLanguage(languageCode));
        }
      }
      if (webhookUrl) {
        await bot.api.setWebhook(webhookUrl, {
          secret_token: this.config.get<string>('TELEGRAM_WEBHOOK_SECRET'),
          allowed_updates: [...ALLOWED_UPDATES],
          max_connections: 40,
        });
        this.logger.log(`Telegram webhook set to ${new URL(webhookUrl).origin}`);
      } else {
        await bot.api.deleteWebhook();
        this.polling = true;
        void bot
          .start({ allowed_updates: [...ALLOWED_UPDATES], onStart: (me) => this.logger.log(`Polling as @${me.username}`) })
          .catch((err: unknown) => this.logger.error(`Polling stopped: ${this.describe(err)}`));
      }
    } catch (err: unknown) {
      this.logger.error(`Telegram transport setup failed: ${this.describe(err)}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.polling) await this.telegram.bot?.stop();
  }

  logError(err: BotError): void {
    // Never log the update itself: it contains the user's financial messages.
    this.logger.error(`Telegram handler failed (update ${err.ctx.update.update_id}): ${this.describe(err.error)}`);
  }

  /**
   * A dev instance that shares the production token would delete the production webhook,
   * steal its updates and repoint the menu button. It stays offline instead.
   */
  private async webhookOwnedElsewhere(bot: Bot): Promise<boolean> {
    const { url } = await bot.api.getWebhookInfo();
    if (!url) return false;
    this.telegram.suspend();
    this.logger.warn(
      `Bot token already has a webhook at ${new URL(url).origin}: the bot is off in this process. ` +
        'Use a separate bot token for local development.',
    );
    return true;
  }

  /**
   * /admin is listed only in the admins' own chats. A chat the bot has never talked to cannot be
   * scoped yet (Telegram answers "chat not found"); typing /admin works there all the same.
   */
  private async showAdminCommand(bot: Bot): Promise<void> {
    for (const id of this.adminAccess.telegramIds) {
      try {
        await bot.api.setMyCommands([...commands('uz'), ...ADMIN_COMMANDS], { scope: { type: 'chat', chat_id: Number(id) } });
      } catch (err: unknown) {
        this.logger.warn(`Admin command menu not set for an admin chat: ${this.describe(err)}`);
      }
    }
  }

  private describe(err: unknown): string {
    if (err instanceof GrammyError) return `${err.method}: ${err.description}`;
    return err instanceof Error ? err.message : String(err);
  }
}
