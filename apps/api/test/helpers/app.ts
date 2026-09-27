import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp, createFastifyAdapter } from '../../src/bootstrap/configure-app';
import { PrismaService } from '../../src/infra/prisma/prisma.service';
import { TelegramBotService } from '../../src/infra/telegram/telegram-bot.service';
import { FakeTelegram } from './fake-telegram';

export interface TestApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
  telegram: FakeTelegram;
  /** Delivers an update to the bot exactly as Telegram's webhook would. */
  deliver: (update: object) => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(1));

  // Must be installed before init(): the bot calls getMe while the app boots.
  const telegram = new FakeTelegram();
  const bot = moduleRef.get(TelegramBotService).bot;
  if (!bot) throw new Error('e2e tests need TELEGRAM_BOT_TOKEN (set in test-env.ts)');
  telegram.install(bot);

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const deliver = async (update: object) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', process.env.TELEGRAM_WEBHOOK_SECRET ?? '')
      .send(update);
    if (res.status !== 200) throw new Error(`webhook returned ${res.status}`);
  };

  return { app, prisma: app.get(PrismaService), telegram, deliver, close: () => app.close() };
}
