// Draws the brand images search engines and link previews use: favicon.ico, the PNG icons and the
// 1200×630 Open Graph card. Run after changing the logo or the tagline, then commit public/:
//   node scripts/generate-brand-assets.mjs
// Uses the Chromium that Playwright already installs for the e2e tests; nothing runs at build time.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const require = createRequire(import.meta.url);
const fontPath = join(dirname(require.resolve('@fontsource-variable/onest/package.json')), 'files', 'onest-latin-wght-normal.woff2');
const font = readFileSync(fontPath).toString('base64');

const BRAND = '#1F7A55';
const PAPER = '#EFEFEC';

/** The logo's three bars on a square; `radius` 0 gives the full-bleed version iOS and Android mask. */
function mark(size, radius) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="${radius}" fill="${BRAND}"/>
    <rect x="7" y="7" width="18" height="5" rx="2.5" fill="#fff"/>
    <rect x="7" y="14" width="12" height="5" rx="2.5" fill="#fff"/>
    <rect x="7" y="21" width="5" height="5" rx="2.5" fill="#fff"/>
  </svg>`;
}

/** Full-bleed icon with the bars inside the 80% safe zone, for apple-touch and maskable icons. */
function maskable(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
    <rect width="40" height="40" fill="${BRAND}"/>
    <g transform="translate(4 4)">
      <rect x="7" y="7" width="18" height="5" rx="2.5" fill="#fff"/>
      <rect x="7" y="14" width="12" height="5" rx="2.5" fill="#fff"/>
      <rect x="7" y="21" width="5" height="5" rx="2.5" fill="#fff"/>
    </g>
  </svg>`;
}

const ogCard = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Onest; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: ${PAPER}; font-family: Onest, sans-serif; color: #17191a; display: flex; padding: 72px; gap: 56px; }
  .left { flex: 1; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 40px; font-weight: 650; letter-spacing: -0.02em; }
  h1 { margin-top: 56px; font-size: 64px; line-height: 1.05; font-weight: 650; letter-spacing: -0.035em; }
  p { margin-top: 24px; font-size: 28px; line-height: 1.35; color: #585d60; }
  .url { margin-top: auto; align-self: flex-start; padding: 12px 24px; border-radius: 999px; background: ${BRAND}; color: #fff; font-size: 28px; font-weight: 600; }
  .chat { width: 380px; align-self: center; display: flex; flex-direction: column; gap: 16px; }
  .bubble { padding: 18px 22px; border-radius: 22px; font-size: 26px; line-height: 1.3; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
  .me { align-self: flex-end; background: ${BRAND}; color: #fff; border-bottom-right-radius: 6px; }
  .bot { background: #fff; border-bottom-left-radius: 6px; }
  .bot b { display: block; font-size: 22px; color: #585d60; font-weight: 500; margin-bottom: 6px; }
  .amount { font-weight: 650; color: #c2412d; }
</style></head><body>
  <div class="left">
    <div class="brand">${mark(64, 9)}FinTrack</div>
    <h1>Pulingiz qayerga ketayotganini biling</h1>
    <p>Xarajat, daromad, byudjet va qarzlar — saytda va Telegram botda.</p>
    <div class="url">myfintrack.uz</div>
  </div>
  <div class="chat">
    <div class="bubble me">50000 taksi</div>
    <div class="bubble bot"><b>Qoralama · Transport</b><span class="amount">−50 000 so‘m</span> · Naqd pul</div>
    <div class="bubble me">+8,5 mln oylik</div>
  </div>
</body></html>`;

/** An .ico holding PNG images (valid since Windows Vista; every current browser reads it). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function shot(html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${html}</body></html>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } });
}

const icoImages = [];
for (const size of [16, 32, 48]) icoImages.push({ size, png: await shot(mark(size, 9), size, size) });
writeFileSync(join(publicDir, 'favicon.ico'), ico(icoImages));
writeFileSync(join(publicDir, 'apple-touch-icon.png'), await shot(maskable(180), 180, 180));
writeFileSync(join(publicDir, 'icon-192.png'), await shot(maskable(192), 192, 192));
writeFileSync(join(publicDir, 'icon-512.png'), await shot(maskable(512), 512, 512));

await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(ogCard);
await page.evaluate(() => document.fonts.ready);
writeFileSync(join(publicDir, 'og-image.png'), await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));

await browser.close();
console.log('Brand assets written to public/');
