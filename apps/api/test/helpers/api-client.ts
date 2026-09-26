import request, { Response } from 'supertest';
import { randomUUID } from 'crypto';
import { TestApp } from './app';

type Body = Record<string, unknown> | unknown[];

let ipCounter = 0;

/**
 * One logged-in user. Each client gets its own fake client IP (via X-Forwarded-For) so the
 * per-IP auth throttling behaves as it would for real, separate users.
 */
export class ApiClient {
  private cookies: string[] = [];
  readonly ip = `10.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}.${Math.floor(Math.random() * 250)}`;
  userId = '';

  constructor(private readonly ctx: TestApp) {}

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
    if (this.cookies.length > 0) req = req.set('Cookie', this.cookies.join('; '));
    const res = body === undefined ? await req : await req.send(body);
    this.storeCookies(res);
    return res;
  }

  private storeCookies(res: Response): void {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    if (!raw) return;
    const jar = new Map(this.cookies.map((c) => [c.split('=')[0], c]));
    for (const line of raw) {
      const pair = line.split(';')[0];
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      if (value === '' || /max-age=0|expires=thu, 01 jan 1970/i.test(line)) jar.delete(name);
      else jar.set(name, pair);
    }
    this.cookies = [...jar.values()];
  }
}

/** Registers a brand-new user (default categories + "Naqd pul" account) and logs them in. */
export async function newUser(ctx: TestApp): Promise<ApiClient> {
  const client = new ApiClient(ctx);
  const res = await client.post('/auth/register', {
    name: 'E2E Foydalanuvchi',
    email: `e2e_${randomUUID()}@fintrack.test`,
    password: 'Parol123!',
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  client.userId = res.body.data.user.id;
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
