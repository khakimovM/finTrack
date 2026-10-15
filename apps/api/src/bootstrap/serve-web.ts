import { existsSync } from 'fs';
import { join, resolve, sep } from 'path';
import fastifyStatic from '@fastify/static';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

/** Pages of the app itself (sign-in, the signed-in app, the admin panel): served the empty shell. */
const APP_PAGE = /^\/(?:login|register|(?:app|admin)(?:\/.*)?)\/?$/;
/** Railway's own hostnames; once the site has its real address, they only redirect there. */
const RAILWAY_HOST = /\.up\.railway\.app$/;

/**
 * Serves the built web app from the API process: one Railway service and one origin, so the
 * session cookies are first-party and no CORS is involved. Vite's hashed assets are cached for a
 * year; HTML is always revalidated so a deploy shows up on the next navigation. Text files go out
 * brotli- or gzip-compressed from the copies the web build writes next to them.
 *
 * "/" gets index.html with the landing page already drawn in (apps/web/scripts/prerender.mjs), so
 * search engines read it without running scripts. App pages get app.html, an empty shell marked
 * noindex; any other address gets the same shell with a real 404 status, never a soft 404.
 */
export async function serveWebApp(app: NestFastifyApplication, dir: string, publicOrigin?: string): Promise<void> {
  const root = resolve(dir);
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(`WEB_DIST_DIR does not contain index.html: ${root}`);
  }
  // A build without the prerender step has no separate shell; index.html serves both.
  const shell = existsSync(join(root, 'app.html')) ? 'app.html' : 'index.html';
  // Only a real https address is canonical; locally CLIENT_URL is the Vite dev server.
  const canonical = publicOrigin?.startsWith('https://') ? new URL(publicOrigin) : null;

  // Same typing mismatch between @nestjs/platform-fastify and fastify plugins as in configure-app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyStatic as any, {
    root,
    wildcard: false,
    index: false,
    preCompressed: true,
    setHeaders: (res: { setHeader(name: string, value: string): void }, filePath: string) => {
      res.setHeader('cache-control', filePath.includes(`${sep}assets${sep}`) ? IMMUTABLE : REVALIDATE);
    },
  });

  const web = app.getHttpAdapter().getInstance();
  // Every web response may come in brotli, gzip or plain: caches must keep them apart. Appended,
  // because CORS has already written "Origin" there.
  web.addHook('onSend', async (request, reply, payload) => {
    if (!request.url.startsWith('/api')) {
      const vary = String(reply.getHeader('vary') ?? '');
      if (!/accept-encoding/i.test(vary)) reply.header('vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
    }
    return payload;
  });

  web.get('/*', (request, reply) => {
    const path = request.url.split('?')[0];
    if (path === '/api' || path.startsWith('/api/')) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Resurs topilmadi' } });
    }

    // One address for search engines and bookmarks: the Railway hostname points to the real one.
    const host = request.hostname.replace(/:\d+$/, '');
    if (canonical && host !== canonical.host && RAILWAY_HOST.test(host)) {
      return reply.header('cache-control', 'public, max-age=3600').redirect(301, `${canonical.origin}${request.url}`);
    }

    reply.header('cache-control', REVALIDATE);
    // @fastify/static augments its own copy of fastify's types, not the one Nest exposes.
    if (path === '/') return (reply as unknown as SendFile).sendFile('index.html');
    reply.header('x-robots-tag', 'noindex');
    if (!APP_PAGE.test(path)) reply.code(404);
    return (reply as unknown as SendFile).sendFile(shell);
  });
}

interface SendFile {
  sendFile(filename: string): unknown;
}
