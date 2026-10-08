import { FastifyRequest } from 'fastify';

/**
 * The Telegram Mini App authenticates with a Bearer token (cookies are unreliable in Telegram's
 * webview); the site always uses the cookie. That is how a request tells which one it came from.
 */
export function isMiniAppRequest(request: FastifyRequest): boolean {
  return request.headers.authorization?.startsWith('Bearer ') ?? false;
}
