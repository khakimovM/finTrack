import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';

function ctx(method: string, headers: Record<string, string> = {}): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const guard = new CsrfGuard(reflector);

  it('allows safe methods without the header', () => {
    expect(guard.canActivate(ctx('GET'))).toBe(true);
  });

  it('rejects cookie writes without X-Requested-With', () => {
    expect(() => guard.canActivate(ctx('POST'))).toThrow(ForbiddenException);
  });

  it('allows writes with X-Requested-With', () => {
    expect(guard.canActivate(ctx('DELETE', { 'x-requested-with': 'XMLHttpRequest' }))).toBe(true);
  });

  it('allows Bearer-authenticated writes', () => {
    expect(guard.canActivate(ctx('POST', { authorization: 'Bearer abc' }))).toBe(true);
  });

  it('honours @SkipCsrf()', () => {
    const skipping = new CsrfGuard({
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector);
    expect(skipping.canActivate(ctx('POST'))).toBe(true);
  });
});
