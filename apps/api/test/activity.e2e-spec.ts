import { readFileSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, firstAccountId, newUser, today } from './helpers/api-client';
import { callbackUpdate, textUpdate, voiceUpdate } from './helpers/fake-telegram';
import { signedInitData } from './helpers/init-data';
import { GeminiClient } from '../src/modules/assistant/providers/gemini.client';
import { GroqSpeechToText } from '../src/modules/assistant/providers/groq-stt.client';
import { ClaudeClient } from '../src/modules/assistant/providers/claude.client';
import { TelegramFilesService } from '../src/infra/telegram/telegram-files.service';

/** Activity and entry sources for the admin panel (docs/09, J2). */
describe('Activity and entry sources (e2e)', () => {
  let ctx: TestApp;
  const gemini = { enabled: true, extractFromAudio: jest.fn(), extractFromText: jest.fn() };

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder
        .overrideProvider(GeminiClient)
        .useValue(gemini)
        .overrideProvider(GroqSpeechToText)
        .useValue({ enabled: false, transcribe: jest.fn() })
        .overrideProvider(ClaudeClient)
        .useValue({ enabled: false, extractFromText: jest.fn() })
        .overrideProvider(TelegramFilesService)
        .useValue({ download: jest.fn().mockResolvedValue(Buffer.from('OggS fake voice')) }),
    );
  });

  afterAll(async () => {
    await ctx.close();
  });

  const sources = async (userId: string) =>
    (await ctx.prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map((t) => [t.type, t.source]);

  const channelsToday = async (userId: string) =>
    (await ctx.prisma.userActivityDay.findMany({ where: { userId, day: new Date(`${today()}T00:00:00Z`) } }))
      .map((d) => d.channel)
      .sort();

  it('marks site entries WEB and records the site visit once, whatever the number of requests', async () => {
    const user = await newUser(ctx, 'Sayt');
    const acc = await firstAccountId(user);
    const food = await categoryId(user, 'Oziq-ovqat');
    const second = (await user.post('/accounts', { name: 'Humo', type: 'CARD', openingBalance: '0' }))
      .body.data.id as string;

    await user.post('/transactions', { type: 'INCOME', accountId: acc, amount: '500000', categoryId: await categoryId(user, 'Oylik'), date: today() });
    await user.post('/transactions', { type: 'EXPENSE', accountId: acc, amount: '1000', categoryId: food, date: today() });
    await user.post('/transfers', { fromAccountId: acc, toAccountId: second, amount: '100', date: today() });
    await user.post('/debts', { direction: 'I_LENT', personName: 'Jasur', accountId: acc, amount: '100' });
    for (let i = 0; i < 10; i++) await user.get('/accounts');

    expect((await sources(user.userId)).every(([, source]) => source === 'WEB')).toBe(true);
    expect(await sources(user.userId)).toHaveLength(5);
    expect(await channelsToday(user.userId)).toContain('WEB');
    const rows = await ctx.prisma.userActivityDay.count({ where: { userId: user.userId, channel: 'WEB' } });
    expect(rows).toBe(1);
    expect((await ctx.prisma.user.findUnique({ where: { id: user.userId } }))?.lastSeenAt).toBeInstanceOf(Date);
  });

  it('marks Mini App entries MINIAPP', async () => {
    const user = await newUser(ctx, 'Ilova');
    const acc = await firstAccountId(user);
    // Resolved first: supertest closes the shared server when a request ends, so no other
    // request may start while this one is being built.
    const food = await categoryId(user, 'Oziq-ovqat');
    const exchange = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/telegram/webapp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ initData: signedInitData(user.telegramUser!) });
    const token = exchange.body.data.accessToken as string;

    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'EXPENSE', accountId: acc, amount: '700', categoryId: food, date: today() });
    expect(res.status).toBe(201);

    expect(await sources(user.userId)).toEqual([['EXPENSE', 'MINIAPP']]);
    expect(await channelsToday(user.userId)).toContain('MINIAPP');
  });

  it('marks bot entries BOT, voice entries VOICE, and records the bot as a channel', async () => {
    const user = await newUser(ctx, 'Bot');
    const tg = user.telegramUser!;
    const save = () => ctx.telegram.button(tg.id, /^d:[\w-]{8}:save$/);

    await ctx.deliver(textUpdate(tg, '50000 taksi'));
    await ctx.deliver(callbackUpdate(tg, save()));

    gemini.extractFromAudio.mockResolvedValue({
      transcript: 'tushlikka qirq besh ming',
      entries: [{ type: 'EXPENSE', amount: '45000', note: 'tushlik', category: 'Oziq-ovqat', account: '', daysAgo: 0 }],
      debtMentioned: false,
    });
    await ctx.deliver(voiceUpdate(tg, 4));
    await ctx.deliver(callbackUpdate(tg, save()));

    expect(await sources(user.userId)).toEqual([
      ['EXPENSE', 'BOT'],
      ['EXPENSE', 'VOICE'],
    ]);
    expect(await channelsToday(user.userId)).toContain('BOT');
  });

  it('marks what a recurring rule books RECURRING, even when started from the site', async () => {
    const user = await newUser(ctx, 'Takror');
    const acc = await firstAccountId(user);
    const rule = await user.post('/recurring', { accountId: acc, type: 'INCOME', amount: '10', frequency: 'MONTHLY', startsAt: today() });
    await user.post(`/recurring/${rule.body.data.id}/run-now`);
    expect(await sources(user.userId)).toEqual([['INCOME', 'RECURRING']]);
  });

  it('fills in past activity from the ledger and sessions, and a second run adds nothing', async () => {
    const user = await newUser(ctx, 'Tarix');
    const acc = await firstAccountId(user);
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    await ctx.prisma.transaction.create({
      data: { userId: user.userId, accountId: acc, type: 'EXPENSE', amount: 100n, date: tenDaysAgo, createdAt: tenDaysAgo },
    });
    await ctx.prisma.user.update({ where: { id: user.userId }, data: { lastSeenAt: null } });

    const sql = readFileSync(resolve(__dirname, '../prisma/migrations/0006_activity/migration.sql'), 'utf8');
    const backfill = sql
      .slice(sql.indexOf('-- Backfill'))
      .split(';')
      .map((statement) => statement.replace(/--.*$/gm, '').trim())
      .filter(Boolean);
    for (let run = 0; run < 2; run++) {
      for (const statement of backfill) await ctx.prisma.$executeRawUnsafe(statement);
    }

    const tashkentDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(tenDaysAgo);
    const past = await ctx.prisma.userActivityDay.findMany({
      where: { userId: user.userId, day: new Date(`${tashkentDay}T00:00:00Z`) },
    });
    expect(past.map((d) => d.channel)).toEqual(['UNKNOWN']);
    expect((await ctx.prisma.user.findUnique({ where: { id: user.userId } }))?.lastSeenAt).toBeInstanceOf(Date);
  });

  it('the activity of a client without a session is not recorded', async () => {
    const before = await ctx.prisma.userActivityDay.count();
    const stranger = new ApiClient(ctx);
    await stranger.get('/accounts');
    expect(await ctx.prisma.userActivityDay.count()).toBe(before);
  });
});
