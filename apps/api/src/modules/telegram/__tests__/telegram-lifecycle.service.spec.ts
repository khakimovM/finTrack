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
import { AdminAccessService } from '../../admin/core/admin-access.service';

const PROD_WEBHOOK = 'https://fintrack.example.com/api/v1/telegram/webhook';

function setup(env: Record<string, string | undefined>, existingWebhook: string) {
  const config = {
    get: (key: string) =>
      ({ TELEGRAM_BOT_TOKEN: '123:fake-token', NODE_ENV: 'development', ADMIN_TELEGRAM_IDS: '7001,7002', ...env })[key],
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
    new AdminAccessService(config),
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

    // Uzbek for everyone, Russian for Telegram apps set to Russian.
    expect(api.setMyShortDescription.mock.calls.map(([, other]) => other?.language_code)).toEqual([undefined, 'ru']);
    for (const [short] of api.setMyShortDescription.mock.calls) {
      expect(short).toContain('myfintrack.uz');
      expect(short.length).toBeLessThanOrEqual(120);
    }
    for (const [long] of api.setMyDescription.mock.calls) {
      expect(long).toContain('https://myfintrack.uz');
      expect(long.length).toBeLessThanOrEqual(512);
    }
    expect(String(api.setMyDescription.mock.calls[1][0])).toContain('такси');
  });

  it('leaves the bot profile alone without an https site (local development)', async () => {
    const { lifecycle, api } = setup({ TELEGRAM_WEBHOOK_URL: PROD_WEBHOOK, CLIENT_URL: 'http://localhost:5173' }, PROD_WEBHOOK);
    await lifecycle.onApplicationBootstrap();
    expect(api.setMyDescription).not.toHaveBeenCalled();
  });

  it('lists /admin only in the admins’ own chats, and a chat Telegram cannot scope does not stop the bot', async () => {
    const { lifecycle, api, telegram } = setup({ TELEGRAM_WEBHOOK_URL: PROD_WEBHOOK }, PROD_WEBHOOK);
    api.setMyCommands.mockImplementation(async (_commands, other) => {
      if (other?.scope?.type === 'chat' && other.scope.chat_id === 7001) throw new Error('Bad Request: chat not found');
      return true;
    });

    await lifecycle.onApplicationBootstrap();

    const calls = api.setMyCommands.mock.calls;
    const [everyone, russian] = calls.filter(([, other]) => !other?.scope);
    const scoped = calls.filter(([, other]) => other?.scope);
    for (const [list] of [everyone, russian]) {
      expect(list.map((c) => c.command)).toEqual(['start', 'menu', 'balans']);
    }
    expect(everyone[1]).toBeUndefined();
    expect(russian[1]).toEqual({ language_code: 'ru' });
    expect(russian[0].map((c) => c.description)).toContain('Меню');
    expect(scoped.map(([, other]) => other?.scope)).toEqual([
      { type: 'chat', chat_id: 7001 },
      { type: 'chat', chat_id: 7002 },
    ]);
    expect(scoped[1][0].map((c) => c.command)).toEqual(['start', 'menu', 'balans', 'admin', 'oylik']);
    expect(api.setWebhook).toHaveBeenCalled();
    expect(telegram.enabled).toBe(true);
  });
});
