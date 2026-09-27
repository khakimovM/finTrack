import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, newUser, today } from './helpers/api-client';
import { callbackUpdate, contactUpdate, textUpdate } from './helpers/fake-telegram';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Telegram sign-in, sessions and account (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function startLogin(client: ApiClient): Promise<{ requestId: string; payload: string }> {
    const res = await client.post('/auth/telegram/start');
    expect(res.status).toBe(201);
    return { requestId: res.body.data.requestId, payload: String(res.body.data.deepLink).split('start=')[1] };
  }

  describe('sign-up and sign-in', () => {
    it('registers a new Telegram user with default categories and a cash account', async () => {
      const user = await newUser(ctx, 'Dilnoza');

      const me = await user.get('/auth/me');
      expect(me.body.data.user).toMatchObject({ name: 'Dilnoza', telegramLinked: true, email: null });
      expect(me.body.data.user.phone).toMatch(/^\+99890\*\*\*\d{4}$/);

      expect((await user.get('/categories')).body.data).toHaveLength(10);
      expect((await user.get('/accounts')).body.data[0]).toMatchObject({ name: 'Naqd pul', isDefault: true });
    });

    it('a returning user gets the code straight away, without sharing the contact again', async () => {
      const first = await newUser(ctx);
      const tgUser = first.telegramUser!;
      const second = new ApiClient(ctx);

      const { requestId, payload } = await startLogin(second);
      await ctx.deliver(textUpdate(tgUser, `/start ${payload}`));

      const status = await second.get(`/auth/telegram/status/${requestId}`);
      expect(status.body.data.status).toBe('CODE_SENT');

      const verify = await second.post('/auth/telegram/verify', { requestId, code: ctx.telegram.lastCode(tgUser.id) });
      expect(verify.status).toBe(200);
      expect(verify.body.data.user.id).toBe(first.userId);
      // Security notice about the new sign-in went to the bot.
      expect(ctx.telegram.messagesTo(tgUser.id).some((m) => m.includes('yangi kirish'))).toBe(true);
    });

    it('counts wrong codes, locks after five and never accepts the right one afterwards', async () => {
      const owner = await newUser(ctx);
      const attacker = new ApiClient(ctx);
      const { requestId, payload } = await startLogin(attacker);
      await ctx.deliver(textUpdate(owner.telegramUser!, `/start ${payload}`));
      const realCode = ctx.telegram.lastCode(owner.telegramUser!.id);
      const wrong = realCode === '000000' ? '111111' : '000000';

      const firstTry = await attacker.post('/auth/telegram/verify', { requestId, code: wrong });
      expect(firstTry.status).toBe(400);
      expect(firstTry.body.error).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: 4 } });

      const rest = await Promise.all(
        Array.from({ length: 4 }, () => attacker.post('/auth/telegram/verify', { requestId, code: wrong })),
      );
      expect(rest.map((r) => r.status).sort()).toEqual([400, 400, 400, 429]);

      const late = await attacker.post('/auth/telegram/verify', { requestId, code: realCode });
      expect(late.status).toBe(422);
      expect(late.body.error.code).toBe('OTP_EXPIRED');
    });

    it('a code works exactly once', async () => {
      const owner = await newUser(ctx);
      const browser = new ApiClient(ctx);
      const { requestId, payload } = await startLogin(browser);
      await ctx.deliver(textUpdate(owner.telegramUser!, `/start ${payload}`));
      const code = ctx.telegram.lastCode(owner.telegramUser!.id);

      expect((await browser.post('/auth/telegram/verify', { requestId, code })).status).toBe(200);
      expect((await new ApiClient(ctx).post('/auth/telegram/verify', { requestId, code })).status).toBe(422);
    });

    it('"Bu men emasman" kills the request', async () => {
      const owner = await newUser(ctx);
      const browser = new ApiClient(ctx);
      const { requestId, payload } = await startLogin(browser);
      await ctx.deliver(textUpdate(owner.telegramUser!, `/start ${payload}`));
      const code = ctx.telegram.lastCode(owner.telegramUser!.id);

      await ctx.deliver(callbackUpdate(owner.telegramUser!, `login_cancel:${requestId}`));

      expect((await browser.get(`/auth/telegram/status/${requestId}`)).body.data.status).toBe('CANCELLED');
      expect((await browser.post('/auth/telegram/verify', { requestId, code })).status).toBe(422);
    });

    it('never registers anyone from a forwarded (foreign) contact card', async () => {
      const tgUser = ctx.telegram.newUser('Mallory');
      const browser = new ApiClient(ctx);
      const { payload } = await startLogin(browser);

      await ctx.deliver(textUpdate(tgUser, `/start ${payload}`));
      await ctx.deliver(contactUpdate(tgUser, tgUser.id + 1, '998901112233'));

      expect(await ctx.prisma.user.count({ where: { telegramId: BigInt(tgUser.id) } })).toBe(0);
      expect(() => ctx.telegram.lastCode(tgUser.id)).toThrow();
    });

    it('the webhook ignores calls without Telegram’s secret token', async () => {
      const res = await new ApiClient(ctx).post('/telegram/webhook', textUpdate(ctx.telegram.newUser(), '/start'));
      expect(res.status).toBe(404);
    });
  });

  describe('sessions', () => {
    it('reusing a rotated refresh token ends the whole session, including its access token', async () => {
      const user = await newUser(ctx);
      const staleRefresh = user.cookie('refreshToken')!;
      const access = user.cookie('accessToken')!;

      // Rotate once, then wait out the 30 s grace window by ageing the revocation.
      expect((await user.post('/auth/refresh')).status).toBe(200);
      await ctx.prisma.refreshToken.updateMany({
        where: { userId: user.userId, revokedAt: { not: null } },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });

      const thief = new ApiClient(ctx);
      thief.setCookies({ refreshToken: staleRefresh });
      const reuse = await thief.post('/auth/refresh');
      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      const oldAccess = new ApiClient(ctx);
      oldAccess.setCookies({ accessToken: access });
      expect((await oldAccess.get('/accounts')).status).toBe(401);
    });

    it('logout-all kills every device immediately', async () => {
      const phone = await newUser(ctx);
      const laptop = new ApiClient(ctx);
      const { requestId, payload } = await startLogin(laptop);
      await ctx.deliver(textUpdate(phone.telegramUser!, `/start ${payload}`));
      await laptop.post('/auth/telegram/verify', { requestId, code: ctx.telegram.lastCode(phone.telegramUser!.id) });

      const sessions = await laptop.get('/users/me/sessions');
      expect(sessions.body.data).toHaveLength(2);
      expect(sessions.body.data.filter((s: { isCurrent: boolean }) => s.isCurrent)).toHaveLength(1);

      expect((await laptop.post('/auth/logout-all')).status).toBe(200);
      expect((await phone.get('/accounts')).status).toBe(401);
    });

    it('ending one session leaves the others alone', async () => {
      const a = await newUser(ctx);
      const b = new ApiClient(ctx);
      const { requestId, payload } = await startLogin(b);
      await ctx.deliver(textUpdate(a.telegramUser!, `/start ${payload}`));
      await b.post('/auth/telegram/verify', { requestId, code: ctx.telegram.lastCode(a.telegramUser!.id) });

      const other = (await a.get('/users/me/sessions')).body.data.find((s: { isCurrent: boolean }) => !s.isCurrent);
      expect((await a.delete(`/users/me/sessions/${other.id}`)).status).toBe(204);
      expect((await b.get('/accounts')).status).toBe(401);
      expect((await a.get('/accounts')).status).toBe(200);
    });
  });

  describe('profile and account', () => {
    it('turning on strict mode takes effect on the next expense', async () => {
      const user = await newUser(ctx);
      const patch = await user.patch('/users/me', { strictMode: true, timezone: 'Asia/Samarkand' });
      expect(patch.body.data.user).toMatchObject({ strictMode: true, timezone: 'Asia/Samarkand' });

      const acc = (await user.get('/accounts')).body.data[0].id;
      const food = await categoryId(user, 'Oziq-ovqat');
      const res = await user.post('/transactions', { type: 'EXPENSE', accountId: acc, amount: '1', categoryId: food, date: today() });
      expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
    });

    it('rejects unknown profile fields and invalid time zones', async () => {
      const user = await newUser(ctx);
      expect((await user.patch('/users/me', { telegramId: '1' })).status).toBe(400);
      expect((await user.patch('/users/me', { timezone: 'Mars/Base' })).status).toBe(400);
    });

    it('deletes the account only with the typed confirmation, then everything is gone', async () => {
      const user = await newUser(ctx);
      const acc = (await user.get('/accounts')).body.data[0].id;
      const food = await categoryId(user, 'Oziq-ovqat');
      await user.post('/transactions', { type: 'EXPENSE', accountId: acc, amount: '5', categoryId: food, date: today() });

      expect((await user.send('delete', '/users/me', { confirm: 'ha' })).status).toBe(400);
      expect((await user.send('delete', '/users/me', { confirm: 'O‘CHIRISH' })).status).toBe(200);

      expect(await ctx.prisma.user.count({ where: { id: user.userId } })).toBe(0);
      expect(await ctx.prisma.transaction.count({ where: { userId: user.userId } })).toBe(0);
      expect((await user.get('/auth/me')).status).toBe(401);
    });

    it('links Telegram to a legacy (email) account, after which Telegram signs into it', async () => {
      const legacy = await ctx.prisma.user.create({ data: { name: 'Eski foydalanuvchi', email: `legacy_${Date.now()}@fintrack.test` } });
      const session = await ctx.app.get(AuthService).issueSession(legacy, {});
      const web = new ApiClient(ctx);
      web.setCookies({ accessToken: session.accessToken, refreshToken: session.refreshToken });

      const link = await web.post('/users/me/telegram/link');
      expect(link.status).toBe(201);
      const tgUser = ctx.telegram.newUser('Legacy');
      await ctx.deliver(textUpdate(tgUser, `/start ${String(link.body.data.deepLink).split('start=')[1]}`));

      expect((await web.get('/auth/me')).body.data.user.telegramLinked).toBe(true);

      const again = new ApiClient(ctx);
      const { requestId, payload } = await startLogin(again);
      await ctx.deliver(textUpdate(tgUser, `/start ${payload}`));
      const verify = await again.post('/auth/telegram/verify', { requestId, code: ctx.telegram.lastCode(tgUser.id) });
      expect(verify.body.data.user.id).toBe(legacy.id);
    });
  });
});
