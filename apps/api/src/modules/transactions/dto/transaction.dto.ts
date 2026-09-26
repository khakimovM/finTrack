import { createZodDto } from 'nestjs-zod';
import {
  CreateTransactionInputSchema,
  UpdateTransactionInputSchema,
  ListTransactionsQuerySchema,
  BulkDeleteTransactionsInputSchema,
} from '@fintrack/shared';

export class CreateTransactionDto extends createZodDto(CreateTransactionInputSchema) {}
export class UpdateTransactionDto extends createZodDto(UpdateTransactionInputSchema) {}
export class ListTransactionsQueryDto extends createZodDto(ListTransactionsQuerySchema) {}
export class BulkDeleteTransactionsDto extends createZodDto(BulkDeleteTransactionsInputSchema) {}
