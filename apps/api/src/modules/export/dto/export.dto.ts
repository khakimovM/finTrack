import { createZodDto } from 'nestjs-zod';
import { ExportTransactionsQuerySchema } from '@fintrack/shared';

export class ExportTransactionsQueryDto extends createZodDto(ExportTransactionsQuerySchema) {}
