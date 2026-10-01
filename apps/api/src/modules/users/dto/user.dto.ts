import { createZodDto } from 'nestjs-zod';
import { DeleteAccountSchema, UpdateProfileSchema } from '@fintrack/shared';

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
export class DeleteAccountDto extends createZodDto(DeleteAccountSchema) {}
