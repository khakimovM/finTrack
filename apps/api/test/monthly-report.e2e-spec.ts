import { endOfMonth, formatIsoDate, parseIsoDate } from '@fintrack/shared';
import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, firstAccountId, newUser, today } from './helpers/api-client';
import { FakeTgUser, callbackUpdate, textUpdate } from './helpers/fake-telegram';
import { OWNER, registerOwner } from './helpers/admin';
import { MonthlyReportService } from '../src/modules/telegram/outbox/monthly-report.service';
import { DailyDigestService } from '../src/modules/telegram/outbox/daily-digest.service';
import { UsersRepository, monthOf } from '../src/modules/users/users.repository';
import { ClockService } from '../src/infra/clock/clock.service';
import { SPEECH_PROVIDERS, SpeechProvider } from '../src/infra/tts/tts.types';

/** What the voice provider was asked to read; it answers with a few bytes instead of audio. */
const spoken: string[] = [];
const fakeVoice: SpeechProvider = {
  id: 'fake-free',
  free: true,
  monthlyChars: null,
  minIntervalMs: 0,
  synthesize: async (text) => {
    spoken.push(text);
    return Buffer.from('OggS-fake');
  },
};

describe('The monthly report (e2e)', () => {
  let ctx: TestApp;
  let clock: ClockService;
  /** 21:00 in Tashkent on the last day of the current month: when the scheduler runs the report. */
  const lastEvening = new Date(`${formatIsoDate(endOfMonth(parseIsoDate(today())))}T16:00:00.000Z`);

  beforeAll(async () => {
    ctx = await createTestApp((b) => b.overrideProvider(SPEECH_PROVIDERS).useValue([fakeVoice]));
    clock = ctx.app.get(ClockService);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await ctx.close();
  });

  const tg = (client: ApiClient): FakeTgUser => {
    if (!client.telegramUser) throw new Error('client has no Telegram identity');
    return client.telegramUser;
  };
  const reports = (chatId: number) => ctx.telegram.messagesTo(chatId).filter((m) => m.includes('oyi hisoboti</b>'));
  const voices = (chatId: number) =>
    ctx.telegram.calls.filter((c) => c.method === 'sendVoice' && Number(c.payload.chat_id) === chatId);

  async function spend(client: ApiClient, amount: string): Promise<void> {
    const accountId = await firstAccountId(client);
    const income = await client.post('/transactions', {
      type: 'INCOME',
      accountId,
      amount: '100000000',
      categoryId: await categoryId(client, 'Oylik'),
      date: today(),
    });
    expect(income.status).toBe(201);
    const expense = await client.post('/transactions', {
      type: 'EXPENSE',
      accountId,
      amount,
      categoryId: await categoryId(client, 'Oziq-ovqat'),
      date: today(),
    });
    expect(expense.status).toBe(201);
  }

  /** Users left by the suites before this one would get a report too; keep the run to ours. */
  async function onlyOurs(ours: ApiClient[]): Promise<void> {
    await ctx.prisma.user.updateMany({
      where: { id: { notIn: ours.map((c) => c.userId) }, monthlyReport: true },
      data: { monthlyReport: false },
    });
  }

  it('goes to those who wrote something this month and kept it on, not to the banned or blocked', async () => {
    const [writer, idle, off, banned, blocked] = await Promise.all(Array.from({ length: 5 }, () => newUser(ctx)));
    await Promise.all([writer, off, banned, blocked].map((c) => spend(c, '4500000')));
    expect((await off.patch('/users/me', { monthlyReport: false })).body.data.user.monthlyReport).toBe(false);
    expect((await writer.get('/auth/me')).body.data.user.monthlyReport).toBe(true);
    await ctx.prisma.user.update({ where: { id: banned.userId }, data: { bannedAt: new Date() } });
    await ctx.prisma.user.update({ where: { id: blocked.userId }, data: { telegramBlockedAt: new Date() } });

    const ours = [writer, idle, off, banned, blocked].map((c) => c.userId);
    const found = await ctx.app.get(UsersRepository).findMonthlyRecipients(monthOf(today()));
    expect(found.map((u) => u.id).filter((id) => ours.includes(id))).toEqual([writer.userId]);
  });

  it('sends the month as a message and then the same read aloud, once, however often the job runs', async () => {
    const user = await newUser(ctx, 'Aziza Karimova');
    await spend(user, '4500000');
    await onlyOurs([user]);
    jest.spyOn(clock, 'now').mockReturnValue(lastEvening);

    const service = ctx.app.get(MonthlyReportService);
    const first = await service.run();
    await service.run();

    expect(first).toMatchObject({ recipients: 1, sent: 1, voiced: 1, providers: { 'fake-free': 1 } });
    const [report] = reports(tg(user).id);
    expect(reports(tg(user).id)).toHaveLength(1);
    expect(report).toContain('⬇️ Chiqim: <b>45 000 so‘m</b>');
    expect(report).toContain('Oziq-ovqat — 45 000 so‘m (100%)');

    const [voice] = voices(tg(user).id);
    expect(voices(tg(user).id)).toHaveLength(1);
    expect(voice.payload.caption).toBe('🎧 Hisobotni tinglang');
    // The voice comes after the text it reads.
    const order = ctx.telegram.calls.filter((c) => Number(c.payload.chat_id) === tg(user).id).map((c) => c.method);
    expect(order.lastIndexOf('sendVoice')).toBeGreaterThan(order.lastIndexOf('sendMessage'));
    const script = spoken.find((s) => s.startsWith('Salom, Aziza!')) ?? '';
    expect(script).toContain('Chiqim: qirq besh ming so‘m.');
    expect(script).not.toMatch(/[<>]|\d/);
  });

  it('takes the place of that evening’s digest, which still goes to those with nothing this month', async () => {
    const [monthly, empty, optedOut] = await Promise.all(Array.from({ length: 3 }, () => newUser(ctx)));
    await Promise.all([monthly, optedOut].map((c) => spend(c, '1000000')));
    await optedOut.patch('/users/me', { monthlyReport: false });
    for (const c of [monthly, empty, optedOut]) await c.patch('/users/me', { dailyDigest: true });
    jest.spyOn(clock, 'now').mockReturnValue(lastEvening);

    await ctx.app.get(DailyDigestService).run();

    const digests = (c: ApiClient) => ctx.telegram.messagesTo(tg(c).id).filter((m) => m.includes('🌙 Kunlik xulosa'));
    expect(digests(monthly)).toHaveLength(0);
    expect(digests(empty)).toHaveLength(1);
    expect(digests(optedOut)).toHaveLength(1);
  });

  it('is switched off from the bot settings like the other notifications', async () => {
    const user = await newUser(ctx);
    await ctx.deliver(textUpdate(tg(user), '⚙️ Sozlamalar'));
    await ctx.deliver(callbackUpdate(tg(user), 'set:monthly'));

    expect((await user.get('/auth/me')).body.data.user.monthlyReport).toBe(false);
    expect(ctx.telegram.last(tg(user).id)).toMatchObject({ method: 'editMessageReplyMarkup' });
  });

  it('/oylik shows the owner this month so far, and nobody else learns the command exists', async () => {
    await registerOwner(ctx);
    const stranger = await newUser(ctx);
    const before = ctx.telegram.calls.length;

    await ctx.deliver(textUpdate(tg(stranger), '/oylik'));
    expect(ctx.telegram.calls.slice(before).filter((c) => Number(c.payload.chat_id) === tg(stranger).id)).toEqual([]);

    await ctx.deliver(textUpdate(OWNER, '/oylik'));
    expect(ctx.telegram.messagesTo(OWNER.id).at(-2)).toContain('hisoboti tayyorlanmoqda');
    expect(reports(OWNER.id).at(-1)).toContain('Umumiy balans');
    expect(voices(OWNER.id)).toHaveLength(1);
  });
});
