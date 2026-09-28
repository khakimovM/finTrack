import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';
import { newUser } from './helpers/api-client';
import { FakeTgUser } from './helpers/fake-telegram';
import { signedInitData } from './helpers/init-data';

describe('Telegram Mini App sign-in (e2e)', () => {
  let ctx: TestApp;
  let ipSeq = 0;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Each call looks like a different client so per-IP throttling does not interfere. */
  function exchange(initData: string) {
    ipSeq += 1;
    return request(ctx.app.getHttpServer())
      .post('/api/v1/auth/telegram/webapp')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('X-Forwarded-For', `10.200.${ipSeq}.1`)
      .send({ initData });
  }

  function me(accessToken: string, cookie?: string) {
    const req = request(ctx.app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  async function registered(): Promise<{ web: Awaited<ReturnType<typeof newUser>>; tg: FakeTgUser }> {
    const web = await newUser(ctx, 'MiniApp');
    if (!web.telegramUser) throw new Error('missing Telegram identity');
    return { web, tg: web.telegramUser };
  }

  it('exchanges signed initData for a Bearer token without setting cookies', async () => {
    const { web, tg } = await registered();

    const res = await exchange(signedInitData(tg));

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body.data).toMatchObject({ user: { id: web.userId }, accessTokenExpiresIn: 900 });
    const profile = await me(res.body.data.accessToken);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.id).toBe(web.userId);
  });

  it('keeps one session per launch and shows it in the sessions list', async () => {
    const { web, tg } = await registered();
    const launch = signedInitData(tg);

    const first = await exchange(launch);
    const again = await exchange(launch);
    await exchange(signedInitData(tg)); // a second launch

    const sessionOf = async (token: string) =>
      ((await request(ctx.app.getHttpServer()).get('/api/v1/users/me/sessions').set('Authorization', `Bearer ${token}`))
        .body.data as Array<{ id: string; isCurrent: boolean; userAgent: string | null }>).find((s) => s.isCurrent);
    expect((await sessionOf(first.body.data.accessToken))?.id).toBe((await sessionOf(again.body.data.accessToken))?.id);

    const sessions = (await web.get('/users/me/sessions')).body.data as Array<{ userAgent: string | null }>;
    expect(sessions.filter((s) => s.userAgent?.startsWith('TelegramMiniApp'))).toHaveLength(2);
  });

  it('asks people without an account to register in the bot first', async () => {
    const stranger = ctx.telegram.newUser('Stranger');
    const res = await exchange(signedInitData(stranger));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TELEGRAM_NOT_REGISTERED');
  });

  it('rejects tampered and stale initData', async () => {
    const { tg } = await registered();
    const tampered = new URLSearchParams(signedInitData(tg));
    tampered.set('user', JSON.stringify({ id: tg.id + 1, first_name: 'Someone else' }));

    const forged = await exchange(tampered.toString());
    const stale = await exchange(signedInitData(tg, { authDate: Math.floor(Date.now() / 1000) - 2 * 24 * 3600 }));

    expect(forged.status).toBe(401);
    expect(forged.body.error.code).toBe('TELEGRAM_INIT_DATA_INVALID');
    expect(stale.status).toBe(401);
    expect(stale.body.error.code).toBe('TELEGRAM_INIT_DATA_EXPIRED');
  });

  it('an ended session stops the token, and the same launch can sign in again', async () => {
    const { web, tg } = await registered();
    const launch = signedInitData(tg);
    const token = (await exchange(launch)).body.data.accessToken as string;

    await web.post('/auth/logout-all');
    expect((await me(token)).status).toBe(401);

    const renewed = await exchange(launch);
    expect(renewed.status).toBe(200);
    expect((await me(renewed.body.data.accessToken)).status).toBe(200);
  });

  it('the Bearer token wins over a web-session cookie of another account', async () => {
    const cookieOwner = await newUser(ctx, 'CookieOwner');
    const { web, tg } = await registered();
    const token = (await exchange(signedInitData(tg))).body.data.accessToken as string;

    const res = await me(token, `accessToken=${cookieOwner.cookie('accessToken')}`);

    expect(res.body.data.user.id).toBe(web.userId);
  });
});
