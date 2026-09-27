import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionStateService } from '../../modules/auth/session-state.service';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let configService: ConfigService;
  let sessions: { isSessionRevoked: jest.Mock; isUserActive: jest.Mock };

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({});
    configService = {
      get: jest.fn().mockReturnValue('test-secret-at-least-32-characters-long'),
    } as unknown as ConfigService;

    sessions = {
      isSessionRevoked: jest.fn().mockResolvedValue(false),
      isUserActive: jest.fn().mockResolvedValue(true),
    };
    guard = new JwtAuthGuard(reflector, jwtService, configService, sessions as unknown as SessionStateService);
  });

  const createMockContext = (options: {
    isPublic?: boolean;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  }): ExecutionContext => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(options.isPublic ?? false);

    const request: Record<string, unknown> = {
      cookies: options.cookies ?? {},
      headers: options.headers ?? {},
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow public route without token', async () => {
    const context = createMockContext({ isPublic: true });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UNAUTHENTICATED when token is missing', async () => {
    const context = createMockContext({ isPublic: false });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should authenticate successfully with valid cookie token', async () => {
    const context = createMockContext({
      isPublic: false,
      cookies: { accessToken: 'valid-cookie-token' },
    });

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'user-123', sid: 'fam-1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest() as Record<string, unknown>;
    expect(req.user).toEqual({ id: 'user-123', sessionId: 'fam-1' });
  });

  it('should authenticate successfully with valid Bearer header token', async () => {
    const context = createMockContext({
      isPublic: false,
      headers: { authorization: 'Bearer valid-bearer-token' },
    });

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'user-456', sid: 'fam-2' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest() as Record<string, unknown>;
    expect(req.user).toEqual({ id: 'user-456', sessionId: 'fam-2' });
  });

  it('should throw UNAUTHENTICATED when verifyAsync fails', async () => {
    const context = createMockContext({
      isPublic: false,
      cookies: { accessToken: 'expired-token' },
    });

    jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose session was revoked (logout-all, ended session)', async () => {
    const context = createMockContext({ cookies: { accessToken: 't' } });
    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'user-1', sid: 'fam-1' });
    sessions.isSessionRevoked.mockResolvedValue(true);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(sessions.isSessionRevoked).toHaveBeenCalledWith('fam-1');
  });

  it('rejects a token of a deleted account', async () => {
    const context = createMockContext({ cookies: { accessToken: 't' } });
    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ sub: 'gone', sid: 'fam-1' });
    sessions.isUserActive.mockResolvedValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
