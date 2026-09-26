import { createZodDto } from 'nestjs-zod';
import { ListNotificationsQuerySchema } from '@fintrack/shared';

export class ListNotificationsQueryDto extends createZodDto(ListNotificationsQuerySchema) {}
