import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { TransactionSource } from '@prisma/client';
import { FastifyRequest } from 'fastify';
import { isMiniAppRequest } from '../utils/request-channel';

/** Where an entry written by this API request comes from: the site or the Mini App. */
export const RequestSource = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TransactionSource =>
    isMiniAppRequest(context.switchToHttp().getRequest<FastifyRequest>()) ? 'MINIAPP' : 'WEB',
);
