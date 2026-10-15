// Runs after `vite build` and the SSR build of src/entry-prerender.tsx (see the build script):
//  1. dist/app.html  — the empty shell, for /app, /admin, /login and 404s: never shows the landing
//                      page, and tells search engines not to index those pages;
//  2. dist/index.html — the same shell with the landing page drawn into #root, for "/";
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

const { renderLanding } = await import(pathToFileURL(join(ssrDir, 'entry-prerender.js')).href);
const landing = renderLanding();
if (!landing.includes('<h1')) fail('the landing page rendered without its h1');
const page = shell
  .replace('<html lang="uz">', '<html lang="uz" data-prerendered="">')
  .replace('<div id="root"></div>', `<div id="root">${landing}</div>`);
writeFileSync(join(dist, 'index.html'), page);
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

console.log(`prerender: landing ${Math.round(landing.length / 1024)} KB into index.html; brotli saves ${Math.round(saved / 1024)} KB`);
