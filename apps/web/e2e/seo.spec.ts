import { expect, test } from '@playwright/test';

/** Both landing pages name each other, and "/" for everyone else. */
const HREFLANG = [
  '<link rel="alternate" hreflang="uz" href="https://myfintrack.uz/" />',
  '<link rel="alternate" hreflang="ru" href="https://myfintrack.uz/ru" />',
  '<link rel="alternate" hreflang="x-default" href="https://myfintrack.uz/" />',
].join('\n    ');

/**
 * What search engines and link previews get from the production build served by the API: the
 * landing page as real HTML with its meta tags, app pages kept out of the index, real 404s, the
 * robots and sitemap files, and compressed assets.
 */
test('the landing page is real HTML with the tags search engines and link previews read', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  expect(res.headers()['x-robots-tag']).toBeUndefined();
  const html = await res.text();

  // Readable without running a script.
  expect(html).toMatch(/<h1[^>]*>Pulingiz qayerga ketayotganini biling/);
  expect(html).toContain('Telegram orqali boshlash');
  expect(html).not.toContain('name="robots"');

  expect(html).toContain('<title>FinTrack — xarajat, daromad va qarzlar hisobi | myfintrack.uz</title>');
  expect(html).toContain('<link rel="canonical" href="https://myfintrack.uz/" />');
  expect(html).toContain('<meta property="og:locale" content="uz_UZ" />');
  expect(html).toContain('<meta property="og:image" content="https://myfintrack.uz/og-image.png" />');
  expect(html).toContain(HREFLANG);
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}';
  const graph = (JSON.parse(ld) as { '@graph': Array<{ '@type': string; alternateName?: unknown }> })['@graph'];
  expect(graph.map((node) => node['@type'])).toEqual(['WebSite', 'Organization', 'WebApplication']);
  expect(graph[0].alternateName).toContain('MyFinTrack');
});

test('/ru is the same page in Russian, with the head tags of its own language', async ({ request }) => {
  const res = await request.get('/ru');
  expect(res.status()).toBe(200);
  expect(res.headers()['x-robots-tag']).toBeUndefined();
  const html = await res.text();

  expect(html).toContain('<html lang="ru" data-prerendered="">');
  expect(html).toMatch(/<h1[^>]*>Знайте, куда уходят ваши деньги/);
  expect(html).toContain('<title>FinTrack — учёт расходов, доходов и долгов | myfintrack.uz</title>');
  expect(html).toContain('<link rel="canonical" href="https://myfintrack.uz/ru" />');
  expect(html).toContain('<meta property="og:url" content="https://myfintrack.uz/ru" />');
  expect(html).toContain('<meta property="og:locale" content="ru_RU" />');
  expect(html).toContain('<meta property="og:locale:alternate" content="uz_UZ" />');
  expect(html).toContain(HREFLANG);
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '{}';
  const app =(JSON.parse(ld) as { '@graph': Array<{ '@type': string; description?: string }> })['@graph'][2];
  expect(app.description).toMatch(/^Приложение для личных финансов/);

  // Every Latin word left on the Russian page is a name: a missed translation would show up here.
  const body = /<div id="root">([\s\S]*)<\/div>\s*<\/body>/.exec(html)?.[1] ?? '';
  let text = body.replace(/<[^>]+>/g, ' ');
  for (const name of ['fintrack_cwa_bot', 'FinTrack', 'Telegram', 'CSV', 'Excel', 'Humo', 'O‘zbekcha']) text = text.split(name).join(' ');
  expect([...new Set(text.match(/[A-Za-z][A-Za-z‘’ʼ'_-]*/g))]).toEqual([]);

  const slash = await request.get('/ru/', { maxRedirects: 0 });
  expect(slash.status()).toBe(301);
  expect(slash.headers().location).toBe('/ru');
});

test('app pages are an empty shell kept out of the index, and unknown addresses are real 404s', async ({ request }) => {
  for (const path of ['/app', '/login', '/admin']) {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()['x-robots-tag']).toBe('noindex');
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('<div id="root"></div>');
  }
  expect((await request.get('/bunday-sahifa-yoq')).status()).toBe(404);
});

test('robots.txt, the sitemap, the icons and the preview image are files, not the app', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toContain('Sitemap: https://myfintrack.uz/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  const urls = await sitemap.text();
  expect(urls).toContain('<loc>https://myfintrack.uz/</loc>');
  expect(urls).toContain('<loc>https://myfintrack.uz/ru</loc>');

  for (const [path, type] of [
    ['/favicon.ico', 'image/'],
    ['/og-image.png', 'image/png'],
    ['/icon-512.png', 'image/png'],
    ['/site.webmanifest', ''],
  ] as const) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()['content-type'], path).toContain(type);
  }
});

test('the page and its script come compressed', async ({ request }) => {
  const page = await request.get('/', { headers: { 'Accept-Encoding': 'br' } });
  expect(page.headers()['content-encoding']).toBe('br');
  const script = /src="(\/assets\/index-[^"]+\.js)"/.exec(await page.text())?.[1];
  expect(script).toBeTruthy();
  const js = await request.get(script ?? '', { headers: { 'Accept-Encoding': 'br' } });
  expect(js.headers()['content-encoding']).toBe('br');
});

test('in a browser the app takes over the prerendered page without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    // A signed-out visitor's session check answers 401; that is the network log, not a script error.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Pulingiz qayerga ketayotganini biling/ })).toBeVisible();
  await page.getByRole('link', { name: 'Kirish' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('the language switch moves between the two addresses, and the choice is kept', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.getByRole('link', { name: 'Русский' }).first().click();
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.getByRole('heading', { level: 1, name: /Знайте, куда уходят ваши деньги/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page).toHaveTitle('FinTrack — учёт расходов, доходов и долгов | myfintrack.uz');

  // The next visit to "/" goes straight on to the Russian page, and so does the login page.
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru$/);
  await page.getByRole('link', { name: 'Войти' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Вход в FinTrack' })).toBeVisible();

  await page.goto('/ru');
  await page.getByRole('link', { name: 'O‘zbekcha' }).first().click();
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.getByRole('heading', { level: 1, name: /Pulingiz qayerga ketayotganini biling/ })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/:\d+\/$/);
  expect(errors).toEqual([]);
});
