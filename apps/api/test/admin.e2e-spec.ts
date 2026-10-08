import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, newUser } from './helpers/api-client';
import { FakeTgUser, contactUpdate, textUpdate } from './helpers/fake-telegram';

/** The admin id set in test-env.ts (ADMIN_TELEGRAM_IDS). */
const OWNER: FakeTgUser = { id: 100_000_001, first_name: 'Ega', username: 'fintrack_owner' };

describe('Admin panel sign-in (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
    // The owner is an ordinary registered user first, like in production.
    const web = new ApiClient(ctx);
    const start = await web.post('/auth/telegram/start');
    await ctx.deliver(textUpdate(OWNER, `/start ${String(start.body.data.deepLink).split('start=')[1]}`));
    await ctx.deliver(contactUpdate(OWNER, OWNER.id, '998901000001'));
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function startAdmin(client: ApiClient): Promise<{ requestId: string; payload: string }> {
    const res = await client.post('/admin/auth/telegram/start');
    expect(res.status).toBe(201);
    return { requestId: res.body.data.requestId, payload: String(res.body.data.deepLink).split('start=')[1] };
  }

  async function signInAsAdmin(): Promise<ApiClient> {
    const browser = new ApiClient(ctx);
    const { requestId, payload } = await startAdmin(browser);
    await ctx.deliver(textUpdate(OWNER, `/start ${payload}`));
    const verify = await browser.post('/admin/auth/telegram/verify', { requestId, code: ctx.telegram.lastCode(OWNER.id) });
    expect(verify.status).toBe(200);
    return browser;
  }

  it('signs the owner in with an admin code from the bot, distinct from the user code', async () => {
    const browser = new ApiClient(ctx);
    const { requestId, payload } = await startAdmin(browser);
    expect(payload).toMatch(/^admin_/);

    await ctx.deliver(textUpdate(OWNER, `/start ${payload}`));
    const codeMessage = ctx.telegram.messagesTo(OWNER.id).reverse().find((m) => /<code>\d{6}<\/code>/.test(m)) ?? '';
    expect(codeMessage).toContain('admin panel');
    expect((await browser.get(`/admin/auth/telegram/status/${requestId}`)).body.data.status).toBe('CODE_SENT');

    const verify = await browser.post('/admin/auth/telegram/verify', { requestId, code: ctx.telegram.lastCode(OWNER.id) });
    expect(verify.status).toBe(200);
    expect(verify.body.data.admin).toMatchObject({ name: 'Ega', telegramUsername: 'fintrack_owner' });
    expect(browser.cookie('ft_admin')).toBeTruthy();
    // No user session comes with it.
    expect(browser.cookie('accessToken')).toBeUndefined();

    const me = await browser.get('/admin/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.admin.name).toBe('Ega');
    // The owner is told in the bot that someone entered the admin panel.
    expect(ctx.telegram.messagesTo(OWNER.id).some((m) => m.includes('Admin panelga kirildi'))).toBe(true);

    const audit = await ctx.prisma.adminAuditLog.findFirst({ where: { action: 'LOGIN' }, orderBy: { createdAt: 'desc' } });
    expect(audit?.telegramId).toBe(BigInt(OWNER.id));
  });

  it('gives anyone else the ordinary "expired" reply, no code, and records the attempt', async () => {
    const stranger = await newUser(ctx, 'Begona');
    const browser = new ApiClient(ctx);
    const { requestId, payload } = await startAdmin(browser);
    const before = ctx.telegram.messagesTo(stranger.telegramUser!.id).length;

    await ctx.deliver(textUpdate(stranger.telegramUser!, `/start ${payload}`));

    const replies = ctx.telegram.messagesTo(stranger.telegramUser!.id).slice(before);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain('muddati tugagan');
    expect(replies[0]).not.toMatch(/<code>\d{6}<\/code>/);
    expect((await browser.get(`/admin/auth/telegram/status/${requestId}`)).body.data.status).toBe('CANCELLED');

    const denied = await ctx.prisma.adminAuditLog.findFirst({
      where: { action: 'LOGIN_DENIED', telegramId: BigInt(stranger.telegramUser!.id) },
    });
    expect(denied?.meta).toMatchObject({ reason: 'not_admin' });
  });

  it('keeps the two sessions apart: a user session cannot open the admin API and vice versa', async () => {
    const user = await newUser(ctx, 'Oddiy');
    const userOnAdmin = await user.get('/admin/auth/me');
    expect(userOnAdmin.status).toBe(404);
    expect(userOnAdmin.body.error.code).toBe('NOT_FOUND');

    const admin = await signInAsAdmin();
    expect((await admin.get('/auth/me')).status).toBe(401);
    expect((await admin.get('/accounts')).status).toBe(401);
  });

  it('answers a forged cookie with the same 404 as an unknown URL', async () => {
    const forged = new ApiClient(ctx);
    forged.setCookies({ ft_admin: 'forged-token' });
    const res = await forged.get('/admin/auth/me');
    const unknown = await forged.get('/admin/no-such-thing');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(unknown.body.error);
  });

  it('does not let a user sign-in request be redeemed or polled as an admin one', async () => {
    const browser = new ApiClient(ctx);
    const start = await browser.post('/auth/telegram/start');
    const requestId = start.body.data.requestId as string;
    expect((await browser.get(`/admin/auth/telegram/status/${requestId}`)).status).toBe(404);
    expect((await browser.post('/admin/auth/telegram/verify', { requestId, code: '123456' })).status).toBe(404);

    const adminStart = await browser.post('/admin/auth/telegram/start');
    expect((await browser.get(`/auth/telegram/status/${adminStart.body.data.requestId}`)).status).toBe(404);
  });

  it('logs out: the cookie is dropped, the session is dead, and it is audited', async () => {
    const admin = await signInAsAdmin();
    const token = admin.cookie('ft_admin')!;
    expect((await admin.post('/admin/auth/logout')).status).toBe(200);
    expect(admin.cookie('ft_admin')).toBeUndefined();

    const replay = new ApiClient(ctx);
    replay.setCookies({ ft_admin: token });
    expect((await replay.get('/admin/auth/me')).status).toBe(404);
    expect(await ctx.prisma.adminAuditLog.count({ where: { action: 'LOGOUT' } })).toBeGreaterThan(0);
  });

  it('tells anyone their Telegram id on /id', async () => {
    await ctx.deliver(textUpdate(OWNER, '/id'));
    expect(ctx.telegram.messagesTo(OWNER.id).at(-1)).toContain(`<code>${OWNER.id}</code>`);
  });
});
