import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import { DomainException } from '../exceptions/domain.exception';

interface MappedError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

const INTERNAL: MappedError = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'INTERNAL_ERROR',
  message: 'Kutilmagan server xatosi yuz berdi',
};

const DEFAULT_CODES: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: { code: 'VALIDATION_ERROR', message: 'Kiritilgan maʼlumotlar yaroqsiz' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHENTICATED', message: 'Autentifikatsiyadan o‘tilmagan' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'Ruxsat berilmagan' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Resurs topilmadi' },
  [HttpStatus.METHOD_NOT_ALLOWED]: { code: 'NOT_FOUND', message: 'Resurs topilmadi' },
  [HttpStatus.CONFLICT]: { code: 'CONFLICT', message: 'Maʼlumotlar to‘qnashuvi' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: { code: 'PAYLOAD_TOO_LARGE', message: 'So‘rov hajmi juda katta' },
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: { code: 'VALIDATION_ERROR', message: 'Kontent turi qo‘llab-quvvatlanmaydi' },
  [HttpStatus.UNPROCESSABLE_ENTITY]: { code: 'UNPROCESSABLE_ENTITY', message: 'So‘rovni bajarib bo‘lmadi' },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'So‘rovlar soni meʼyordan oshdi. Birozdan so‘ng qayta urinib ko‘ring',
  },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = (request?.id as string) || `req-${Date.now()}`;

    const mapped = this.map(exception);
    if (mapped.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`[${requestId}] ${request?.method} ${request?.url} failed`, stack);
    }

    response.status(mapped.status).send({
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details ? { details: mapped.details } : {}),
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof DomainException) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof ZodValidationException) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Kiritilgan maʼlumotlar yaroqsiz',
        details: {
          issues: exception.getZodError().issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.mapHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    // Fastify raises plain errors with a statusCode for malformed bodies, bad content types, etc.
    const statusCode = (exception as { statusCode?: unknown })?.statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      const fallback = DEFAULT_CODES[statusCode] ?? DEFAULT_CODES[HttpStatus.BAD_REQUEST];
      return { status: statusCode, ...fallback };
    }

    return INTERNAL;
  }

  private mapHttpException(exception: HttpException): MappedError {
    const status = exception.getStatus();
    const fallback = DEFAULT_CODES[status];
    const res = exception.getResponse();

    let code = fallback?.code ?? (status >= 500 ? INTERNAL.code : 'ERROR');
    let message = fallback?.message ?? exception.message;
    let details: Record<string, unknown> | undefined;

    if (typeof res === 'object' && res !== null) {
      const body = res as Record<string, unknown>;
      if (typeof body.code === 'string') code = body.code;
      if (typeof body.message === 'string' && typeof body.code === 'string') message = body.message;
      if (body.details && typeof body.details === 'object') {
        details = body.details as Record<string, unknown>;
      }
    } else if (typeof res === 'string' && !fallback) {
      message = res;
    }

    // Throttler and Nest built-ins ship English messages; users only ever see Uzbek.
    if (status === HttpStatus.TOO_MANY_REQUESTS && fallback) {
      code = fallback.code;
      message = fallback.message;
    }

    if (status >= 500) return { ...INTERNAL, status };
    return { status, code, message, details };
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): MappedError {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: 'Bunday yozuv allaqachon mavjud',
        };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Resurs topilmadi' };
      case 'P2003':
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          code: 'INVALID_REFERENCE',
          message: 'Bog‘langan yozuv topilmadi yoki undan foydalanilmoqda',
        };
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'VALIDATION_ERROR',
          message: 'Kiritilgan qiymat juda uzun',
        };
      case 'P2034':
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONCURRENT_UPDATE',
          message: 'Maʼlumot bir vaqtda o‘zgartirildi. Qayta urinib ko‘ring',
        };
      default:
        return INTERNAL;
    }
  }
}
