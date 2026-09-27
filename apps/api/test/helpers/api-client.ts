import request, { Response } from 'supertest';
import { TestApp } from './app';
import { FakeTgUser, contactUpdate, textUpdate } from './fake-telegram';

type Body = Record<string, unknown> | unknown[];

let ipCounter = 0;

/**
 * One logged-in user. Each client gets its own fake client IP (via X-Forwarded-For) so the
 * per-IP auth throttling behaves as it would for real, separate users.
 */
export class ApiClient {
  /** Browser-like jar: a cookie is identified by name AND path. */
  private jar = new Map<string, { name: string; value: string; path: string }>();
  readonly ip = `10.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}.${Math.floor(Math.random() * 250)}`;
  userId = '';
  telegramUser: FakeTgUser | null = null;

  constructor(private readonly ctx: TestApp) {}

  cookie(name: string): string | undefined {
    return [...this.jar.values()].find((c) => c.name === name)?.value;
  }

  /** Replaces the cookie jar, e.g. to replay an old refresh token or impersonate a session. */
  setCookies(cookies: Record<string, string>): void {
    this.jar = new Map(Object.entries(cookies).map(([name, value]) => [`${name};/`, { name, value, path: '/' }]));
  }

  private cookieHeader(requestPath: string): string {
    return [...this.jar.values()]
      .filter((c) => requestPath.startsWith(c.path))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  get(path: string): Promise<Response> {
    return this.send('get', path);
  }
  post(path: string, body?: Body): Promise<Response> {
    return this.send('post', path, body);
  }
  patch(path: string, body?: Body): Promise<Response> {
    return this.send('patch', path, body);
  }
  delete(path: string): Promise<Response> {
    return this.send('delete', path);
  }

  async send(method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: Body): Promise<Response> {
    let req = request(this.ctx.app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('X-Forwarded-For', this.ip)
      .set('X-Requested-With', 'XMLHttpRequest');
    const cookieHeader = this.cookieHeader(`/api/v1${path}`);
    if (cookieHeader) req = req.set('Cookie', cookieHeader);
    const res = body === undefined ? await req : await req.send(body);
    this.storeCookies(res);
    return res;
  }

  private storeCookies(res: Response): void {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    if (!raw) return;
    for (const line of raw) {
      const pair = line.split(';')[0];
      const name = pair.slice(0, pair.indexOf('='));
      const value = pair.slice(pair.indexOf('=') + 1);
      const path = /;\s*path=([^;]+)/i.exec(line)?.[1] ?? '/';
      const key = `${name};${path}`;
      if (value === '' || /max-age=0|expires=thu, 01 jan 1970/i.test(line)) this.jar.delete(key);
      else this.jar.set(key, { name, value, path });
    }
  }
}

/**
 * Signs a brand-new user up exactly like a real person would: web asks for a login link, the
 * user opens it in Telegram, shares their contact, and types the code the bot sent.
 */
export async function newUser(ctx: TestApp, firstName = 'E2E'): Promise<ApiClient> {
  const tgUser = ctx.telegram.newUser(firstName);
  const client = new ApiClient(ctx);
  client.telegramUser = tgUser;

  const start = await client.post('/auth/telegram/start');
  if (start.status !== 201) throw new Error(`start failed: ${start.status} ${JSON.stringify(start.body)}`);
  const payload = String(start.body.data.deepLink).split('start=')[1];

  await ctx.deliver(textUpdate(tgUser, `/start ${payload}`));
  await ctx.deliver(contactUpdate(tgUser, tgUser.id, `99890${String(tgUser.id).slice(-7)}`));

  const verify = await client.post('/auth/telegram/verify', {
    requestId: start.body.data.requestId,
    code: ctx.telegram.lastCode(tgUser.id),
  });
  if (verify.status !== 200) throw new Error(`verify failed: ${verify.status} ${JSON.stringify(verify.body)}`);
  client.userId = verify.body.data.user.id;
  return client;
}

export async function firstAccountId(client: ApiClient): Promise<string> {
  const res = await client.get('/accounts');
  return res.body.data[0].id as string;
}

export async function categoryId(client: ApiClient, name: string): Promise<string> {
  const res = await client.get('/categories');
  const found = (res.body.data as Array<{ id: string; name: string }>).find((c) => c.name === name);
  if (!found) throw new Error(`category ${name} not found`);
  return found.id;
}

export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}
