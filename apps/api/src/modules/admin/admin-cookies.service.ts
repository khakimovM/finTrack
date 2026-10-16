import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ADMIN_TOKEN_HEADER } from '@fintrack/shared';

export const ADMIN_COOKIE = 'ft_admin';
/** Sent only to the admin API: user pages and the user API never see the admin session. */
const ADMIN_COOKIE_PATH = '/api/v1/admin';

@Injectable()
export class AdminCookiesService {
  constructor(private readonly config: ConfigService) {}

  set(res: FastifyReply, token: string, expiresAt: Date): void {
    res.setCookie(ADMIN_COOKIE, token, {
      ...this.baseOptions(),
      maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    });
  }

  clear(res: FastifyReply): void {
    res.clearCookie(ADMIN_COOKIE, this.baseOptions());
  }

  /**
   * The admin session token: the X-Admin-Token header in Telegram's Mini App, the cookie in a
   * browser. The header wins: only the Mini App sets it, and an old cookie in the same webview
   * must not shadow it. Another site can never make a browser send it, so no CSRF risk either.
   */
  read(req: FastifyRequest): string | undefined {
    const header = req.headers[ADMIN_TOKEN_HEADER.toLowerCase()];
    if (typeof header === 'string' && header) return header;
    return (req as unknown as { cookies?: Record<string, string> }).cookies?.[ADMIN_COOKIE];
  }

  private baseOptions() {
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      // Strict: no other site can ever make the browser send it, not even a top-level link.
      sameSite: 'strict' as const,
      path: ADMIN_COOKIE_PATH,
      domain: domain && domain !== 'localhost' ? domain : undefined,
    };
  }
}
