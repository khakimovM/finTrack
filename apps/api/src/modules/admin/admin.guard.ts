import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UseGuards,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAccessService } from './core/admin-access.service';
import { AdminCookiesService } from './admin-cookies.service';
import { AdminPrincipal, AdminSessionService } from './admin-session.service';

/**
 * Lets a request through only with a live admin session. Everyone else gets the same 404 as an
 * unknown URL, so the admin API does not reveal that it exists.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly access: AdminAccessService,
    private readonly sessions: AdminSessionService,
    private readonly cookies: AdminCookiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.access.enabled) throw new NotFoundException();
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const admin = await this.sessions.resolve(this.cookies.read(request));
    if (!admin) throw new NotFoundException();
    (request as unknown as { admin: AdminPrincipal }).admin = admin;
    return true;
  }
}

/**
 * An admin-only route: outside the user session (no access-token check), inside the admin one.
 * Every admin controller method uses this instead of the global JWT guard.
 */
export const AdminOnly = () => applyDecorators(Public(), UseGuards(AdminGuard));

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminPrincipal =>
    (context.switchToHttp().getRequest<FastifyRequest>() as unknown as { admin: AdminPrincipal }).admin,
);
