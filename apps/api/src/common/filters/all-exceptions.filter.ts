import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import { DomainException } from '../exceptions/domain.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const requestId = (request?.id as string) || `req-${Date.now()}`;
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Kutilmagan server xatosi yuz berdi';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof DomainException) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Kiritilgan maʼlumotlar yaroqsiz';
      const zodError = exception.getZodError();
      details = {
        issues: zodError.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        if (resObj.code && typeof resObj.code === 'string') {
          code = resObj.code;
        }
        if (resObj.details && typeof resObj.details === 'object') {
          details = resObj.details as Record<string, unknown>;
        }
      }

      if (code === 'INTERNAL_ERROR') {
        switch (status) {
          case HttpStatus.NOT_FOUND:
            code = 'NOT_FOUND';
            message = message || 'Resurs topilmadi';
            break;
          case HttpStatus.UNAUTHORIZED:
            code = 'UNAUTHENTICATED';
            message = message || 'Autentifikatsiyadan o‘tilmagan';
            break;
          case HttpStatus.FORBIDDEN:
            code = 'FORBIDDEN';
            break;
          case HttpStatus.BAD_REQUEST:
            code = 'VALIDATION_ERROR';
            break;
          case HttpStatus.TOO_MANY_REQUESTS:
            code = 'RATE_LIMITED';
            message = 'So‘rovlar soni meʼyordan oshdi. Birozdan so‘ng qayta urinib ko‘ring';
            break;
          case HttpStatus.CONFLICT:
            code = 'CONFLICT';
            break;
          case HttpStatus.UNPROCESSABLE_ENTITY:
            code = 'UNPROCESSABLE_ENTITY';
            break;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${requestId}] Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
    }

    const errorEnvelope = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        requestId,
        timestamp,
      },
    };

    response.status(status).send(errorEnvelope);
  }
}
