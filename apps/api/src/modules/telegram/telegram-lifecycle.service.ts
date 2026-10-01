import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotError, GrammyError } from 'grammy';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { AuthHandlers } from './handlers/auth.handlers';
import { MenuHandlers } from './handlers/menu.handlers';
import { DebtHandlers } from './handlers/debt.handlers';
import { EntryHandlers } from './handlers/entry.handlers';
import { VoiceHandlers } from './handlers/voice.handlers';
import { miniAppUrl } from './bot-ui';

export const ALLOWED_UPDATES = ['message', 'callback_query'] as const;

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
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const bot = this.telegram.bot;
    if (!bot) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set: Telegram sign-in and the bot are disabled');
      return;
    }

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
      await bot.api.setMyCommands([
        { command: 'start', description: 'Boshlash / kirish' },
        { command: 'menu', description: 'Menyu' },
        { command: 'balans', description: 'Balans' },
      ]);
      // The menu button next to the input field opens the Mini App with signed initData.
      const appUrl = miniAppUrl(this.config.get<string>('WEB_APP_URL') ?? this.config.get<string>('CLIENT_URL'));
      await bot.api.setChatMenuButton({
        menu_button: appUrl ? { type: 'web_app', text: 'Ilova', web_app: { url: appUrl } } : { type: 'commands' },
      });
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

  private describe(err: unknown): string {
    if (err instanceof GrammyError) return `${err.method}: ${err.description}`;
    return err instanceof Error ? err.message : String(err);
  }
}
