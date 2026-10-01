import { existsSync } from 'fs';
import { join, resolve, sep } from 'path';
import fastifyStatic from '@fastify/static';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

/**
 * Serves the built web app from the API process: one Railway service and one origin, so the
 * session cookies are first-party and no CORS is involved. Vite's hashed assets are cached for a
 * year; index.html is always revalidated so a deploy shows up on the next navigation. Any other
 * GET outside /api gets index.html and the client-side router takes over.
 */
export async function serveWebApp(app: NestFastifyApplication, dir: string): Promise<void> {
  const root = resolve(dir);
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(`WEB_DIST_DIR does not contain index.html: ${root}`);
  }

  // Same typing mismatch between @nestjs/platform-fastify and fastify plugins as in configure-app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyStatic as any, {
    root,
    wildcard: false,
    index: false,
    setHeaders: (res: { setHeader(name: string, value: string): void }, filePath: string) => {
      res.setHeader('cache-control', filePath.includes(`${sep}assets${sep}`) ? IMMUTABLE : REVALIDATE);
    },
  });

  app
    .getHttpAdapter()
    .getInstance()
    .get('/*', (request, reply) => {
      if (request.url === '/api' || request.url.startsWith('/api/')) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Resurs topilmadi' } });
      }
      // @fastify/static augments its own copy of fastify's types, not the one Nest exposes.
      return (reply.header('cache-control', REVALIDATE) as unknown as SendFile).sendFile('index.html');
    });
}

interface SendFile {
  sendFile(filename: string): unknown;
}
