import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cookie-authenticated writes must carry `X-Requested-With`. Browsers refuse to attach custom
 * headers to cross-site form posts without a CORS preflight, so this blocks CSRF even where
 * SameSite=Lax cookies would still be sent (top-level navigations).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    // Bearer tokens are not sent automatically by the browser, so they cannot be forged cross-site.
    if (request.headers.authorization?.startsWith('Bearer ')) return true;

    if (request.headers['x-requested-with'] === 'XMLHttpRequest') return true;

    throw new ForbiddenException({
      code: 'CSRF_REJECTED',
      message: 'So‘rov manbasi tasdiqlanmadi',
    });
  }
}
