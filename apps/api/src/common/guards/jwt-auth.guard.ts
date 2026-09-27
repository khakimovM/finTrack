import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionStateService } from '../../modules/auth/session-state.service';

export interface AccessTokenPayload {
  sub: string;
  /** Session (refresh-token family) id: lets one session be revoked without the others. */
  sid?: string;
}

export interface AuthenticatedUser {
  id: string;
  sessionId?: string;
}

const unauthenticated = (message = 'Autentifikatsiyadan o‘tilmagan') =>
  new UnauthorizedException({ code: 'UNAUTHENTICATED', message });

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessions: SessionStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);
    if (!token) throw unauthenticated();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw unauthenticated('Token yaroqsiz yoki muddati tugagan');
    }

    if (await this.sessions.isSessionRevoked(payload.sid)) {
      throw unauthenticated('Sessiya yakunlangan. Qaytadan kiring');
    }
    if (!(await this.sessions.isUserActive(payload.sub))) {
      throw unauthenticated('Hisob topilmadi');
    }

    const user: AuthenticatedUser = { id: payload.sub, sessionId: payload.sid };
    (request as unknown as { user: AuthenticatedUser }).user = user;
    return true;
  }

  private extractToken(request: FastifyRequest): string | null {
    const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies;
    if (cookies?.accessToken) return cookies.accessToken;

    // The Telegram Mini App cannot rely on cookies inside Telegram Web's iframe.
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return null;
  }
}
