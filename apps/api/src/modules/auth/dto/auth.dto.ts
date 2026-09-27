import { createZodDto } from 'nestjs-zod';
import { TelegramRequestRefSchema, VerifyTelegramLoginSchema } from '@fintrack/shared';

export class VerifyTelegramLoginDto extends createZodDto(VerifyTelegramLoginSchema) {}
export class TelegramRequestRefDto extends createZodDto(TelegramRequestRefSchema) {}
