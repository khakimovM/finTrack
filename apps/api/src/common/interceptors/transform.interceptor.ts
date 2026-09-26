import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((res) => {
        const httpResponse = context.switchToHttp?.()?.getResponse?.();
        if (httpResponse?.sent || Buffer.isBuffer(res)) {
          return res;
        }

        // If already formatted envelope, return as is
        if (res && typeof res === 'object' && 'success' in res && res.success === true) {
          return res;
        }

        // If returned shape contains data & meta
        if (res && typeof res === 'object' && 'data' in res && 'meta' in res) {
          return {
            success: true,
            data: res.data,
            meta: res.meta,
          };
        }

        return {
          success: true,
          data: res ?? null,
        };
      }),
    );
  }
}
