import { createZodDto } from 'nestjs-zod';
import { TelegramRequestRefSchema, TelegramWebAppAuthSchema, VerifyTelegramLoginSchema } from '@fintrack/shared';

export class VerifyTelegramLoginDto extends createZodDto(VerifyTelegramLoginSchema) {}
export class TelegramRequestRefDto extends createZodDto(TelegramRequestRefSchema) {}
export class TelegramWebAppAuthDto extends createZodDto(TelegramWebAppAuthSchema) {}
