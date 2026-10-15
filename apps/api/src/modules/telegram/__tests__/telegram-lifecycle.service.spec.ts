import { ConfigService } from '@nestjs/config';
import type { Bot } from 'grammy';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TelegramBotService } from '../../../infra/telegram/telegram-bot.service';
import { AuthHandlers } from '../handlers/auth.handlers';
import { DebtHandlers } from '../handlers/debt.handlers';
import { EntryHandlers } from '../handlers/entry.handlers';
import { MenuHandlers } from '../handlers/menu.handlers';
import { VoiceHandlers } from '../handlers/voice.handlers';
import { TelegramLifecycleService } from '../telegram-lifecycle.service';
import { ActivityService } from '../../activity/activity.service';
import { BotUserService } from '../bot-user.service';

const PROD_WEBHOOK = 'https://fintrack.example.com/api/v1/telegram/webhook';

function setup(env: Record<string, string | undefined>, existingWebhook: string) {
  const config = {
    get: (key: string) => ({ TELEGRAM_BOT_TOKEN: '123:fake-token', NODE_ENV: 'development', ...env })[key],
  } as unknown as ConfigService;
  const telegram = new TelegramBotService(config, {} as unknown as PrismaService);
  const bot = telegram.bot as Bot;

  jest.spyOn(bot, 'init').mockResolvedValue(undefined);
  const start = jest.spyOn(bot, 'start').mockResolvedValue(undefined);
  const api = {
    getWebhookInfo: jest
      .spyOn(bot.api, 'getWebhookInfo')
      .mockResolvedValue({ url: existingWebhook, has_custom_certificate: false, pending_update_count: 0 }),
    setMyCommands: jest.spyOn(bot.api, 'setMyCommands').mockResolvedValue(true),
    setMyDescription: jest.spyOn(bot.api, 'setMyDescription').mockResolvedValue(true),
    setMyShortDescription: jest.spyOn(bot.api, 'setMyShortDescription').mockResolvedValue(true),
    setChatMenuButton: jest.spyOn(bot.api, 'setChatMenuButton').mockResolvedValue(true),
    setWebhook: jest.spyOn(bot.api, 'setWebhook').mockResolvedValue(true),
    deleteWebhook: jest.spyOn(bot.api, 'deleteWebhook').mockResolvedValue(true),
    sendMessage: jest.spyOn(bot.api, 'sendMessage'),
  };

  const handlers = { register: jest.fn(), registerTextFallback: jest.fn() };
  const lifecycle = new TelegramLifecycleService(
    telegram,
    config,
    handlers as unknown as AuthHandlers,
    handlers as unknown as MenuHandlers,
    handlers as unknown as DebtHandlers,
    handlers as unknown as EntryHandlers,
    handlers as unknown as VoiceHandlers,
    { touchTelegram: jest.fn() } as unknown as ActivityService,
    { refuseBanned: jest.fn(async () => false) } as unknown as BotUserService,
  );
  return { lifecycle, telegram, api, start };
}

describe('TelegramLifecycleService transport', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stays offline in polling mode when the token already has a webhook', async () => {
    const { lifecycle, telegram, api, start } = setup({}, PROD_WEBHOOK);

    await lifecycle.onApplicationBootstrap();

    expect(api.deleteWebhook).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(api.setMyCommands).not.toHaveBeenCalled();
    expect(api.setChatMenuButton).not.toHaveBeenCalled();
    expect(telegram.enabled).toBe(false);
    await expect(telegram.send(42, 'salom')).resolves.toBe('DISABLED');
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('polls when the token has no webhook', async () => {
    const { lifecycle, telegram, api, start } = setup({}, '');

    await lifecycle.onApplicationBootstrap();

    expect(api.deleteWebhook).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
    expect(telegram.enabled).toBe(true);
  });

  it('takes over the webhook in webhook mode without asking who owns it', async () => {
    const { lifecycle, telegram, api, start } = setup({ TELEGRAM_WEBHOOK_URL: PROD_WEBHOOK }, PROD_WEBHOOK);

    await lifecycle.onApplicationBootstrap();

    expect(api.getWebhookInfo).not.toHaveBeenCalled();
    expect(api.setWebhook).toHaveBeenCalledWith(PROD_WEBHOOK, expect.objectContaining({ max_connections: 40 }));
    expect(start).not.toHaveBeenCalled();
    expect(telegram.enabled).toBe(true);
  });

  it('names the website in the bot profile once the site has a public https address', async () => {
    const { lifecycle, api } = setup({ TELEGRAM_WEBHOOK_URL: PROD_WEBHOOK, CLIENT_URL: 'https://myfintrack.uz' }, PROD_WEBHOOK);

    await lifecycle.onApplicationBootstrap();

    const short = String(api.setMyShortDescription.mock.calls[0][0]);
    const long = String(api.setMyDescription.mock.calls[0][0]);
    expect(short).toContain('myfintrack.uz');
    expect(short.length).toBeLessThanOrEqual(120);
    expect(long).toContain('https://myfintrack.uz');
    expect(long.length).toBeLessThanOrEqual(512);
  });

  it('leaves the bot profile alone without an https site (local development)', async () => {
    const { lifecycle, api } = setup({ TELEGRAM_WEBHOOK_URL: PROD_WEBHOOK, CLIENT_URL: 'http://localhost:5173' }, PROD_WEBHOOK);
    await lifecycle.onApplicationBootstrap();
    expect(api.setMyDescription).not.toHaveBeenCalled();
  });
});
