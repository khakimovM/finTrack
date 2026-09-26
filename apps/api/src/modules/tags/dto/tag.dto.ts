import { createZodDto } from 'nestjs-zod';
import { CreateTagInputSchema, UpdateTagInputSchema } from '@fintrack/shared';

export class CreateTagDto extends createZodDto(CreateTagInputSchema) {}
export class UpdateTagDto extends createZodDto(UpdateTagInputSchema) {}
