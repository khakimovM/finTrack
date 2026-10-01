import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyReply } from 'fastify';
import { durationToMs } from '../../common/utils/duration';

/** The refresh token is only needed by /auth/refresh and /auth/logout — never send it elsewhere. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Injectable()
export class AuthCookiesService {
  constructor(private readonly config: ConfigService) {}

  set(res: FastifyReply, accessToken: string, refreshToken: string): void {
    const base = this.baseOptions();
    res.setCookie('accessToken', accessToken, {
      ...base,
      path: '/',
      maxAge: this.seconds('ACCESS_TOKEN_TTL', '15m'),
    });
    res.setCookie('refreshToken', refreshToken, {
      ...base,
      path: REFRESH_COOKIE_PATH,
      maxAge: this.seconds('REFRESH_TOKEN_TTL', '7d'),
    });
    // Drop the refresh cookie older builds scoped to "/".
    res.clearCookie('refreshToken', { path: '/', domain: base.domain });
  }

  clear(res: FastifyReply): void {
    const { domain } = this.baseOptions();
    res.clearCookie('accessToken', { path: '/', domain });
    res.clearCookie('refreshToken', { path: REFRESH_COOKIE_PATH, domain });
    res.clearCookie('refreshToken', { path: '/', domain });
  }

  private baseOptions() {
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      domain: domain && domain !== 'localhost' ? domain : undefined,
    };
  }

  private seconds(key: string, fallback: string): number {
    return Math.floor(durationToMs(this.config.get<string>(key, fallback)) / 1000);
  }
}
