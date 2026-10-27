// Runs after `vite build` and the SSR build of src/entry-prerender.tsx (see the build script):
//  1. dist/app.html  — the empty shell, for /app, /admin, /login and 404s: never shows the landing
//                      page, and tells search engines not to index those pages;
//  2. dist/index.html — the same shell with the Uzbek landing page drawn into #root, for "/", and
//     dist/ru.html the Russian one, for "/ru", each with the title and tags of its language;
//  3. .br and .gz copies of every text file, served by the API when the browser accepts them.
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrDir = join(root, 'dist-prerender');

// Production React: no development warnings and the same output the browser gets.
process.env.NODE_ENV = 'production';

function fail(message) {
  console.error(`prerender: ${message}`);
  process.exit(1);
}

const shell = readFileSync(join(dist, 'index.html'), 'utf8');
if (!shell.includes('<div id="root"></div>')) fail('dist/index.html has no empty #root');

const appShell = shell.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex" />');
writeFileSync(join(dist, 'app.html'), appShell);

const { renderLanding, landingHead } = await import(pathToFileURL(join(ssrDir, 'entry-prerender.js')).href);

const ORIGIN = 'https://myfintrack.uz';
const PAGES = [
  { locale: 'uz', file: 'index.html', og: 'uz_UZ', ogAlternate: 'ru_RU' },
  { locale: 'ru', file: 'ru.html', og: 'ru_RU', ogAlternate: 'uz_UZ' },
];

const html = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Puts `value` between the two groups of `pattern`; a tag missing from index.html stops the build. */
function put(page, pattern, value, what) {
  if (!pattern.test(page)) fail(`index.html has no ${what}`);
  return page.replace(pattern, (_, before, after) => `${before}${value}${after}`);
}

const meta = (attr) => new RegExp(`(<meta\\s+${attr}\\s+content=")[^"]*(")`);

const rendered = [];
for (const { locale, file, og, ogAlternate } of PAGES) {
  const landing = renderLanding(locale);
  if (!landing.includes('<h1')) fail(`the ${locale} landing page rendered without its h1`);
  if (rendered.includes(landing)) fail(`the ${locale} landing page is the same as another language's`);
  rendered.push(landing);

  const head = landingHead(locale);
  const url = `${ORIGIN}${head.path}`;
  let page = shell;
  page = put(page, /(<html lang=")uz(">)/, `${locale}" data-prerendered="`, '<html lang="uz">');
  page = put(page, /(<title>)[^<]*(<\/title>)/, html(head.title), '<title>');
  page = put(page, meta('name="description"'), html(head.description), 'description');
  page = put(page, /(<link rel="canonical" href=")[^"]*(")/, url, 'canonical link');
  page = put(page, meta('property="og:locale"'), og, 'og:locale');
  page = put(page, meta('property="og:locale:alternate"'), ogAlternate, 'og:locale:alternate');
  page = put(page, meta('property="og:url"'), url, 'og:url');
  page = put(page, meta('property="og:title"'), html(head.ogTitle), 'og:title');
  page = put(page, meta('property="og:description"'), html(head.ogDescription), 'og:description');
  page = put(page, meta('property="og:image:alt"'), html(head.ogImageAlt), 'og:image:alt');
  page = put(page, meta('name="twitter:title"'), html(head.ogTitle), 'twitter:title');
  page = put(page, meta('name="twitter:description"'), html(head.twitterDescription), 'twitter:description');
  // The structured data's one description, written as a JSON string.
  page = put(page, /("description": ")[^"]*(")/, JSON.stringify(head.appDescription).slice(1, -1), 'JSON-LD description');
  page = page.replace('<div id="root"></div>', `<div id="root">${landing}</div>`);
  writeFileSync(join(dist, file), page);
}
const sizes = rendered.map((landing, i) => `${PAGES[i].locale} ${Math.round(landing.length / 1024)} KB`);
rmSync(ssrDir, { recursive: true, force: true });

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.xml', '.txt', '.webmanifest', '.ico']);
let saved = 0;
function compressAll(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      compressAll(path);
      continue;
    }
    if (!COMPRESSIBLE.has(extname(name))) continue;
    const raw = readFileSync(path);
    if (raw.length < 1024) continue;
    const br = brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } });
    const gz = gzipSync(raw, { level: 9 });
    if (br.length < raw.length) writeFileSync(`${path}.br`, br);
    if (gz.length < raw.length) writeFileSync(`${path}.gz`, gz);
    saved += raw.length - br.length;
  }
}
compressAll(dist);

console.log(`prerender: landing ${sizes.join(', ')}; brotli saves ${Math.round(saved / 1024)} KB`);
