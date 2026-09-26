import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should wrap raw response in success envelope', (done) => {
    const mockContext = {} as ExecutionContext;
    const mockCallHandler: CallHandler = {
      handle: () => of({ foo: 'bar' }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: { foo: 'bar' },
      });
      done();
    });
  });

  it('should preserve existing meta if present in response', (done) => {
    const mockContext = {} as ExecutionContext;
    const mockCallHandler: CallHandler = {
      handle: () => of({ data: [1, 2, 3], meta: { total: 3 } }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: [1, 2, 3],
        meta: { total: 3 },
      });
      done();
    });
  });

  it('should not double-wrap if already formatted envelope', (done) => {
    const mockContext = {} as ExecutionContext;
    const existing = { success: true, data: { already: 'done' } };
    const mockCallHandler: CallHandler = {
      handle: () => of(existing),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual(existing);
      done();
    });
  });
});
