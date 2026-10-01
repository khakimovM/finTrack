import { createZodDto } from 'nestjs-zod';
import {
  CreateAccountInputSchema,
  UpdateAccountInputSchema,
  ReorderAccountsInputSchema,
  ListAccountsQuerySchema,
} from '@fintrack/shared';

export class CreateAccountDto extends createZodDto(CreateAccountInputSchema) {}
export class UpdateAccountDto extends createZodDto(UpdateAccountInputSchema) {}
export class ReorderAccountsDto extends createZodDto(ReorderAccountsInputSchema) {}
export class ListAccountsQueryDto extends createZodDto(ListAccountsQuerySchema) {}
