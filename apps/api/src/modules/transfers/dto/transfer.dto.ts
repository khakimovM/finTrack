import { createZodDto } from 'nestjs-zod';
import { CreateTransferInputSchema } from '@fintrack/shared';

export class CreateTransferDto extends createZodDto(CreateTransferInputSchema) {}
