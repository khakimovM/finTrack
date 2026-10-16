import request from 'supertest';
import type { TestApp } from './helpers/app';
import type { FakeTgUser } from './helpers/fake-telegram';

/** The site the bot's /admin button opens; Telegram opens only HTTPS Mini Apps. */
const SITE = 'https://myfintrack.uz';

describe('Admin panel inside Telegram: the bot’s /admin button (e2e)', () => {
  let ctx: TestApp;
  let helpers: {
    OWNER: FakeTgUser;
    textUpdate: typeof import('./helpers/fake-telegram').textUpdate;
    signedInitData: typeof import('./helpers/init-data').signedInitData;
    newUser: typeof import('./helpers/api-client').newUser;
  };
  const previous = process.env.WEB_APP_URL;
  let ipSeq = 0;

  beforeAll(async () => {
    process.env.WEB_APP_URL = SITE;
    // The config is read when the app module loads, so load it only now that WEB_APP_URL is set.
    const [{ createTestApp }, admin, telegram, initData, apiClient] = await Promise.all([
      import('./helpers/app'),
      import('./helpers/admin'),
      import('./helpers/fake-telegram'),
      import('./helpers/init-data'),
      import('./helpers/api-client'),
    ]);
    ctx = await createTestApp();
    await admin.registerOwner(ctx);
    helpers = { OWNER: admin.OWNER, textUpdate: telegram.textUpdate, signedInitData: initData.signedInitData, newUser: apiClient.newUser };
  });

  afterAll(async () => {
    await ctx.close();
    if (previous === undefined) delete process.env.WEB_APP_URL;
    else process.env.WEB_APP_URL = previous;
  });

  /** Each call looks like a different client so per-IP throttling does not interfere. */
  function exchange(initData: string) {
    ipSeq += 1;
    return request(ctx.app.getHttpServer())
      .post('/api/v1/admin/auth/telegram/webapp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('X-Forwarded-For', `10.210.${ipSeq}.1`)
      .send({ initData });
  }

  const withToken = (method: 'get' | 'post', path: string, token: string) =>
    request(ctx.app.getHttpServer())[method](`/api/v1${path}`).set('X-Requested-With', 'XMLHttpRequest').set('X-Admin-Token', token);

  /** The inline buttons of the bot's newest message in a chat. */
  function lastButtons(chatId: number): Array<{ text: string; web_app?: { url: string } }> {
    const sent = ctx.telegram.calls.filter((c) => c.method === 'sendMessage' && Number(c.payload.chat_id) === chatId).at(-1);
    const markup = sent?.payload.reply_markup as { inline_keyboard?: Array<Array<{ text: string; web_app?: { url: string } }>> } | undefined;
    return markup?.inline_keyboard?.flat() ?? [];
  }

  it('answers the owner’s /admin with a button that opens the panel as a Mini App', async () => {
    await ctx.deliver(helpers.textUpdate(helpers.OWNER, '/admin'));
    expect(ctx.telegram.messagesTo(helpers.OWNER.id).at(-1)).toContain('Admin panel');
    expect(lastButtons(helpers.OWNER.id)).toEqual([expect.objectContaining({ web_app: { url: `${SITE}/admin` } })]);
  });

  it('stays silent to anyone else, like any unknown command', async () => {
    const stranger = await helpers.newUser(ctx, 'Begona');
    const chat = stranger.telegramUser!.id;
    const before = ctx.telegram.calls.length;
    await ctx.deliver(helpers.textUpdate(stranger.telegramUser!, '/admin'));
    expect(ctx.telegram.calls.slice(before).filter((c) => Number(c.payload.chat_id) === chat)).toEqual([]);
  });

  it('signs the owner in with the launch data: a token for the header, no cookie, one session per launch', async () => {
    const initData = helpers.signedInitData(helpers.OWNER);
    const res = await exchange(initData);
    expect(res.status).toBe(200);
    expect(res.body.data.admin).toMatchObject({ name: 'Ega', telegramUsername: 'fintrack_owner' });
    expect(typeof res.body.data.token).toBe('string');
    expect(res.headers['set-cookie']).toBeUndefined();

    const token = res.body.data.token as string;
    const me = await withToken('get', '/admin/auth/me', token);
    expect(me.status).toBe(200);
    expect((await withToken('get', '/admin/stats/overview', token)).status).toBe(200);
    // An admin session is not a user session.
    expect((await withToken('get', '/auth/me', token)).status).toBe(401);

    const audit = await ctx.prisma.adminAuditLog.findFirst({ where: { action: 'LOGIN' }, orderBy: { createdAt: 'desc' } });
    expect(audit?.meta).toMatchObject({ via: 'miniapp' });
    expect(ctx.telegram.messagesTo(helpers.OWNER.id).some((m) => m.includes('Admin panelga kirildi'))).toBe(true);

    // The same launch data again (a reload, or a copy) does not open a second session.
    const again = await exchange(initData);
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe('TELEGRAM_INIT_DATA_EXPIRED');
  });

  it('refuses old or forged launch data', async () => {
    const old = await exchange(helpers.signedInitData(helpers.OWNER, { authDate: Math.floor(Date.now() / 1000) - 11 * 60 }));
    expect(old.status).toBe(401);
    expect(old.body.error.code).toBe('TELEGRAM_INIT_DATA_EXPIRED');

    const forged = helpers.signedInitData(helpers.OWNER).replace(/hash=[0-9a-f]+/, `hash=${'0'.repeat(64)}`);
    const res = await exchange(forged);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TELEGRAM_INIT_DATA_INVALID');
  });

  it('answers a non-admin’s valid launch data with the panel’s usual 404 and audits it', async () => {
    const stranger = await helpers.newUser(ctx, 'Qiziquvchan');
    const res = await exchange(helpers.signedInitData(stranger.telegramUser!));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const denied = await ctx.prisma.adminAuditLog.findFirst({
      where: { action: 'LOGIN_DENIED', telegramId: BigInt(stranger.telegramUser!.id) },
    });
    expect(denied?.meta).toMatchObject({ reason: 'not_admin', via: 'miniapp' });
  });

  it('logs out with the header token too', async () => {
    const token = (await exchange(helpers.signedInitData(helpers.OWNER))).body.data.token as string;
    expect((await withToken('post', '/admin/auth/logout', token)).status).toBe(200);
    expect((await withToken('get', '/admin/auth/me', token)).status).toBe(404);
  });
});
