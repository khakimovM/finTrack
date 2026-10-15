import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { brotliCompressSync } from 'zlib';
import request from 'supertest';
import type { TestApp } from './helpers/app';

const LANDING = '<!doctype html><html data-prerendered><title>FinTrack</title><div id="root"><h1>FinTrack landing</h1></div>';
const SHELL = '<!doctype html><meta name="robots" content="noindex"><title>FinTrack</title><div id="root"></div><!-- app shell -->';
const SCRIPT = `console.log(${JSON.stringify('app '.repeat(400))})`;

describe('Web app served by the API process (e2e)', () => {
  let ctx: TestApp;
  let dist: string;
  const previous = { dir: process.env.WEB_DIST_DIR, client: process.env.CLIENT_URL };

  beforeAll(async () => {
    // What `npm run build` in apps/web leaves: prerendered index.html, the app.html shell, and
    // brotli copies of text files next to them.
    dist = mkdtempSync(join(tmpdir(), 'fintrack-web-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), LANDING);
    writeFileSync(join(dist, 'index.html.br'), brotliCompressSync(LANDING));
    writeFileSync(join(dist, 'app.html'), SHELL);
    writeFileSync(join(dist, 'assets', 'index-abc123.js'), SCRIPT);
    writeFileSync(join(dist, 'assets', 'index-abc123.js.br'), brotliCompressSync(SCRIPT));
    writeFileSync(join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    process.env.WEB_DIST_DIR = dist;
    process.env.CLIENT_URL = 'https://myfintrack.uz';
    // The config is validated when the app module loads, so load it only now that CLIENT_URL is set.
    const { createTestApp } = await import('./helpers/app');
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
    for (const [key, value] of [['WEB_DIST_DIR', previous.dir], ['CLIENT_URL', previous.client]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dist, { recursive: true, force: true });
  });

  const get = (path: string) => request(ctx.app.getHttpServer()).get(path);

  it('answers "/" with the prerendered landing page, indexable and never cached', async () => {
    const res = await get('/?utm_source=telegram');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['x-robots-tag']).toBeUndefined();
    expect(res.text).toContain('FinTrack landing');
  });

  it.each(['/login', '/app', '/app/debts?debt=00000000-0000-4000-8000-000000000001', '/admin/users/', '/register'])(
    'answers the app page %s with the empty shell, kept out of search results',
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['x-robots-tag']).toBe('noindex');
      expect(res.text).toContain('app shell');
    },
  );

  it('answers an address that is no page with a real 404, not a soft one', async () => {
    for (const path of ['/no-such-page', '/application', '/apps/x']) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(res.headers['x-robots-tag']).toBe('noindex');
      expect(res.text).toContain('app shell');
    }
  });

  it('serves robots.txt as a file, not as the app', async () => {
    const res = await get('/robots.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('User-agent');
  });

  it('caches hashed assets for a year and sends the brotli copy to browsers that accept it', async () => {
    const asset = await get('/assets/index-abc123.js').set('Accept-Encoding', 'br');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(asset.headers['content-encoding']).toBe('br');
    expect(String(asset.headers.vary)).toMatch(/accept-encoding/i);

    const plain = await get('/assets/index-abc123.js').set('Accept-Encoding', 'identity');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.text).toBe(SCRIPT);

    const icon = await get('/favicon.svg');
    expect(icon.headers['cache-control']).toBe('no-cache');
  });

  it('sends the landing page compressed too', async () => {
    const res = await get('/').set('Accept-Encoding', 'br');
    expect(res.headers['content-encoding']).toBe('br');
    expect(res.text).toContain('FinTrack landing');
  });

  it('sends pages on the Railway hostname to the real address, but leaves the API there alone', async () => {
    const page = await get('/app/debts?x=1').set('Host', 'fintrackuz.up.railway.app');
    expect(page.status).toBe(301);
    expect(page.headers.location).toBe('https://myfintrack.uz/app/debts?x=1');

    expect((await get('/').set('Host', 'myfintrack.uz')).status).toBe(200);
    expect((await get('/api/v1/health').set('Host', 'fintrackuz.up.railway.app')).status).toBe(200);
  });

  it('keeps the API untouched: real routes work, unknown ones are JSON 404s', async () => {
    expect((await get('/api/v1/health')).status).toBe(200);

    const missing = await get('/api/v1/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('lets only Telegram Web frame the app and allows the Telegram script', async () => {
    const res = await get('/');
    const csp = String(res.headers['content-security-policy']);

    expect(csp).toContain("frame-ancestors 'self' https://web.telegram.org");
    expect(csp).toMatch(/script-src 'self' https:\/\/telegram\.org/);
    expect(res.headers['x-frame-options']).toBeUndefined();
  });
});
