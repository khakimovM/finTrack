import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers/app';

describe('Web app served by the API process (e2e)', () => {
  let ctx: TestApp;
  let dist: string;
  const previous = process.env.WEB_DIST_DIR;

  beforeAll(async () => {
    dist = mkdtempSync(join(tmpdir(), 'fintrack-web-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>FinTrack test shell</title><div id="root"></div>');
    writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log("app")');
    writeFileSync(join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    process.env.WEB_DIST_DIR = dist;
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
    if (previous === undefined) delete process.env.WEB_DIST_DIR;
    else process.env.WEB_DIST_DIR = previous;
    rmSync(dist, { recursive: true, force: true });
  });

  const get = (path: string) => request(ctx.app.getHttpServer()).get(path);

  it.each(['/', '/login', '/app/debts?debt=00000000-0000-4000-8000-000000000001'])(
    'answers %s with index.html for the client-side router, never cached',
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.text).toContain('FinTrack test shell');
    },
  );

  it('caches hashed assets for a year and other files not at all', async () => {
    const asset = await get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const icon = await get('/favicon.svg');
    expect(icon.headers['cache-control']).toBe('no-cache');
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
