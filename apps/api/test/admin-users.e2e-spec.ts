import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, firstAccountId, newUser, today } from './helpers/api-client';
import { OWNER, registerOwner, signInAsAdmin } from './helpers/admin';
import { FakeTgUser, textUpdate } from './helpers/fake-telegram';
import { signedInitData } from './helpers/init-data';

type Row = { id: string; entries: number; status: string };

/** docs/09, J4: the people list, bans, ending sessions, CSV, the system page and the audit log. */
describe('Admin: people, bans, the system and the audit log (e2e)', () => {
  let ctx: TestApp;
  let admin: ApiClient;

  beforeAll(async () => {
    ctx = await createTestApp();
    await registerOwner(ctx);
    admin = await signInAsAdmin(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function addExpense(user: ApiClient): Promise<void> {
    const accountId = await firstAccountId(user);
    const food = await categoryId(user, 'Oziq-ovqat');
    const res = await user.post('/transactions', { type: 'EXPENSE', accountId, amount: '1000', categoryId: food, date: today() });
    expect(res.status).toBe(201);
  }

  function miniAppExchange(user: ApiClient) {
    return request(ctx.app.getHttpServer())
      .post('/api/v1/auth/telegram/webapp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ initData: signedInitData(user.telegramUser as FakeTgUser) });
  }

  /** An existing person signs in on the site again with a code from the bot. */
  async function signIn(tg: FakeTgUser): Promise<{ browser: ApiClient; requestId: string; status: number }> {
    const browser = new ApiClient(ctx);
    const start = await browser.post('/auth/telegram/start');
    const requestId = start.body.data.requestId as string;
    await ctx.deliver(textUpdate(tg, `/start ${String(start.body.data.deepLink).split('start=')[1]}`));
    const status = (await browser.get(`/auth/telegram/status/${requestId}`)).body.data.status as string;
    if (status !== 'CODE_SENT') return { browser, requestId, status: 0 };
    const verify = await browser.post('/auth/telegram/verify', { requestId, code: ctx.telegram.lastCode(tg.id) });
    return { browser, requestId, status: verify.status };
  }

  it('finds people by name, @username or Telegram ID and shows their activity, never money', async () => {
    const zebo = await newUser(ctx, 'Zebo Qidiruv');
    await addExpense(zebo);
    await addExpense(zebo);
    const tg = zebo.telegramUser as FakeTgUser;

    for (const q of ['zebo qidir', `@${tg.username}`, String(tg.id)]) {
      const res = await admin.get(`/admin/users?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((u: Row) => u.id)).toEqual([zebo.userId]);
    }
    const res = await admin.get(`/admin/users?q=${tg.id}`);
    const [row] = res.body.data;
    expect(row).toMatchObject({
      name: 'Zebo Qidiruv',
      telegramUsername: tg.username,
      entries: 2,
      accounts: 1,
      channels: ['BOT', 'WEB'],
      status: 'active',
      botBlocked: false,
    });
    expect(row.phone).toMatch(/^\+998 •• ••• •• \d{2}$/);
    expect(res.body.meta).toEqual({ page: 1, limit: 25, total: 1, totalPages: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/amount|balance|note/i);
    // `%` is a letter to search for, not "anything".
    expect((await admin.get('/admin/users?q=%25')).body.data).toEqual([]);
  });

  it('filters by status, sorts by entries and pages', async () => {
    const busy = await newUser(ctx, 'Faol yozuvchi');
    for (let i = 0; i < 3; i++) await addExpense(busy);

    const page = await admin.get('/admin/users?sort=entries&limit=2');
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(2);
    expect(page.body.data[0].entries).toBeGreaterThanOrEqual(page.body.data[1].entries);
    expect(page.body.meta.totalPages).toBe(Math.ceil(page.body.meta.total / 2));
    expect((await admin.get('/admin/users?sort=entries&limit=2&page=2')).body.data[0].entries).toBeLessThanOrEqual(
      page.body.data[1].entries,
    );

    const active = await admin.get('/admin/users?status=active&limit=100');
    expect(active.body.data.every((u: Row) => u.status === 'active')).toBe(true);
    expect((await admin.get('/admin/users?status=nope')).status).toBe(400);
  });

  it('shows one person: counts, where the entries came from and 90 days of activity', async () => {
    const user = await newUser(ctx, 'Tafsilot');
    await addExpense(user);

    const res = await admin.get(`/admin/users/${user.userId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: user.userId, status: 'active', isAdmin: false, bannedAt: null });
    expect(res.body.data.counts).toMatchObject({ entries: 1, accounts: 1, debts: 0, activeSessions: 1 });
    expect(res.body.data.entriesBySource).toEqual({ web: 1, miniApp: 0, bot: 0, voice: 0, recurring: 0, unknown: 0 });
    expect(res.body.data.activity).toEqual([{ day: today(), channels: ['BOT', 'WEB'] }]);
    expect((await admin.get('/admin/users/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('a ban ends every session and closes the site, the Mini App and the bot', async () => {
    const user = await newUser(ctx, 'Bloklanuvchi');
    const tg = user.telegramUser as FakeTgUser;
    expect((await miniAppExchange(user)).status).toBe(200);

    const res = await admin.post(`/admin/users/${user.userId}/ban`, { reason: 'Spam <yozuvlar>' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ status: 'banned', banReason: 'Spam <yozuvlar>' });
    expect(res.body.data.counts.activeSessions).toBe(0);

    // The site: the open session stops at once, and a refresh says why.
    expect((await user.get('/accounts')).status).toBe(401);
    const refresh = await user.post('/auth/refresh');
    expect(refresh.status).toBe(403);
    expect(refresh.body.error.code).toBe('ACCOUNT_BANNED');

    // The Mini App.
    const exchange = await miniAppExchange(user);
    expect(exchange.status).toBe(403);
    expect(exchange.body.error.code).toBe('ACCOUNT_BANNED');

    // The bot: told once, with the reason, then every message gets the same answer and does nothing.
    expect(ctx.telegram.messagesTo(tg.id).some((m) => m.includes('bloklandi') && m.includes('Spam &lt;yozuvlar&gt;'))).toBe(true);
    const before = ctx.telegram.messagesTo(tg.id).length;
    await ctx.deliver(textUpdate(tg, '50000 taksi'));
    expect(ctx.telegram.messagesTo(tg.id).slice(before)).toEqual([expect.stringContaining('bloklangan')]);
    expect(await ctx.prisma.transaction.count({ where: { userId: user.userId, type: 'EXPENSE' } })).toBe(0);

    // Signing in again on the site: no code, and the waiting page learns the request is over.
    const again = await signIn(tg);
    expect(again.status).toBe(0);
    expect((await again.browser.get(`/auth/telegram/status/${again.requestId}`)).body.data.status).toBe('CANCELLED');

    const audit = await ctx.prisma.adminAuditLog.findFirst({ where: { action: 'BAN', targetUserId: user.userId } });
    expect(audit?.meta).toEqual({ reason: 'Spam <yozuvlar>', sessions: 2 });
  });

  it('after an unban the person can sign in again', async () => {
    const user = await newUser(ctx, 'Qaytgan');
    const tg = user.telegramUser as FakeTgUser;
    expect((await admin.post(`/admin/users/${user.userId}/ban`, { reason: 'Tekshiruv' })).status).toBe(200);

    const res = await admin.post(`/admin/users/${user.userId}/unban`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ status: 'active', bannedAt: null, banReason: null });
    expect(ctx.telegram.messagesTo(tg.id).at(-1)).toContain('qayta ochildi');

    expect((await signIn(tg)).status).toBe(200);
    expect((await miniAppExchange(user)).status).toBe(200);
    const audit = await ctx.prisma.adminAuditLog.findFirst({ where: { action: 'UNBAN', targetUserId: user.userId } });
    expect(audit?.meta).toEqual({ reason: 'Tekshiruv' });
  });

  it('will not ban an admin, ban twice, unban someone not banned or touch a deleted account', async () => {
    const owner = await ctx.prisma.user.findFirstOrThrow({ where: { telegramId: BigInt(OWNER.id) } });
    const self = await admin.post(`/admin/users/${owner.id}/ban`, { reason: 'Sinov uchun' });
    expect(self.status).toBe(422);
    expect(self.body.error.code).toBe('CANNOT_BAN_ADMIN');
    expect((await admin.get(`/admin/users/${owner.id}`)).body.data.user.isAdmin).toBe(true);

    const user = await newUser(ctx, 'Ikki marta');
    expect((await admin.post(`/admin/users/${user.userId}/unban`)).status).toBe(409);
    expect((await admin.post(`/admin/users/${user.userId}/ban`, { reason: 'x' })).status).toBe(400);
    expect((await admin.post(`/admin/users/${user.userId}/ban`, { reason: 'Birinchi' })).status).toBe(200);
    expect((await admin.post(`/admin/users/${user.userId}/ban`, { reason: 'Ikkinchi' })).status).toBe(409);

    const gone = await newUser(ctx, 'Ketgan');
    await ctx.prisma.user.update({ where: { id: gone.userId }, data: { deletedAt: new Date() } });
    expect((await admin.post(`/admin/users/${gone.userId}/ban`, { reason: 'Kech qoldi' })).status).toBe(409);
    expect((await admin.get(`/admin/users?q=${gone.telegramUser?.id}&status=deleted`)).body.data[0].status).toBe('deleted');
  });

  it('ends every session without a ban: the person signs in again', async () => {
    const user = await newUser(ctx, 'Sessiyali');
    const res = await admin.post(`/admin/users/${user.userId}/revoke-sessions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ revoked: 1 });
    expect((await user.get('/accounts')).status).toBe(401);
    expect((await signIn(user.telegramUser as FakeTgUser)).status).toBe(200);

    const audit = await ctx.prisma.adminAuditLog.findFirst({ where: { action: 'REVOKE_SESSIONS', targetUserId: user.userId } });
    expect(audit?.meta).toEqual({ sessions: 1 });
  });

  it('exports the list as CSV: masked phones, defused formulas, no money, and it is recorded', async () => {
    await newUser(ctx, '=HYPERLINK("http://x")');
    const res = await admin.get(`/admin/users/export.csv?q=${encodeURIComponent('HYPERLINK')}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('ID,Ism,Username,Telefon,Ro‘yxatdan o‘tgan,Oxirgi faollik,Yozuvlar,Hisoblar,Kanallar (30 kun),Holat');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(lines[1]).toMatch(/'\+998 •• ••• •• \d{2}/);
    expect(lines[1]).toMatch(/,0,1,Bot,Faol$/);

    const audit = await ctx.prisma.adminAuditLog.findFirst({ where: { action: 'EXPORT' }, orderBy: { createdAt: 'desc' } });
    expect(audit?.meta).toMatchObject({ rows: 1, q: 'HYPERLINK', status: 'all' });
  });

  it('reports the system: database, Redis, queues, Telegram and the running version', async () => {
    const res = await admin.get('/admin/system');
    expect(res.status).toBe(200);
    const system = res.body.data;
    expect(system.database.status).toBe('ok');
    expect(system.database.sizeBytes).toBeGreaterThan(0);
    expect(system.database.lastMigration).toMatch(/^\d{4}_/);
    expect(system.redis.status).toBe('ok');
    expect(system.queues.map((q: { name: string }) => q.name)).toEqual(['recurring', 'debt-reminders', 'telegram-outbox', 'daily-digest', 'broadcast']);
    for (const queue of system.queues) expect(queue.counts).not.toBeNull();
    expect(system.telegram).toMatchObject({ mode: 'polling', webhookHost: null, pendingUpdates: 0 });
    expect(system.version).toMatchObject({ commit: null, node: process.version, environment: 'test' });
  });

  it('lists what was done in the panel, newest first, with the names of the people involved', async () => {
    const all = await admin.get('/admin/audit?limit=100');
    expect(all.status).toBe(200);
    const times = all.body.data.map((e: { createdAt: string }) => e.createdAt);
    expect(times).toEqual([...times].sort().reverse());

    const bans = await admin.get('/admin/audit?action=BAN');
    expect(bans.body.data.length).toBeGreaterThan(0);
    for (const entry of bans.body.data) {
      expect(entry.action).toBe('BAN');
      expect(entry.admin.name).toBe('Ega');
      expect(entry.target.name).toEqual(expect.any(String));
    }
    expect((await admin.get('/admin/audit?action=NOPE')).status).toBe(400);
  });

  it('is invisible to anyone without an admin session', async () => {
    const user = await newUser(ctx, 'Qiziquvchan');
    const paths = ['/admin/users', `/admin/users/${user.userId}`, '/admin/users/export.csv', '/admin/system', '/admin/audit'];
    for (const path of paths) {
      expect((await user.get(path)).status).toBe(404);
      expect((await new ApiClient(ctx).get(path)).status).toBe(404);
    }
    expect((await user.post(`/admin/users/${user.userId}/ban`, { reason: 'O‘zimni' })).status).toBe(404);
    expect((await user.post(`/admin/users/${user.userId}/revoke-sessions`)).status).toBe(404);
  });
});
