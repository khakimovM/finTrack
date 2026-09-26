import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({});
    configService = {
      get: jest.fn().mockReturnValue('test-secret-at-least-32-characters-long'),
    } as unknown as ConfigService;

    guard = new JwtAuthGuard(reflector, jwtService, configService);
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

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
      sub: 'user-123',
      email: 'aziz@mail.uz',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest() as Record<string, unknown>;
    expect(req.user).toEqual({ id: 'user-123', email: 'aziz@mail.uz' });
  });

  it('should authenticate successfully with valid Bearer header token', async () => {
    const context = createMockContext({
      isPublic: false,
      headers: { authorization: 'Bearer valid-bearer-token' },
    });

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
      sub: 'user-456',
      email: 'test@mail.uz',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest() as Record<string, unknown>;
    expect(req.user).toEqual({ id: 'user-456', email: 'test@mail.uz' });
  });

  it('should throw UNAUTHENTICATED when verifyAsync fails', async () => {
    const context = createMockContext({
      isPublic: false,
      cookies: { accessToken: 'expired-token' },
    });

    jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
