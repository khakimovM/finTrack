import { createZodDto } from 'nestjs-zod';
import {
  CreateDebtInputSchema,
  UpdateDebtInputSchema,
  CreateDebtPaymentInputSchema,
  SettleDebtInputSchema,
  ListDebtsQuerySchema,
} from '@fintrack/shared';

export class CreateDebtDto extends createZodDto(CreateDebtInputSchema) {}
export class UpdateDebtDto extends createZodDto(UpdateDebtInputSchema) {}
export class CreateDebtPaymentDto extends createZodDto(CreateDebtPaymentInputSchema) {}
export class SettleDebtDto extends createZodDto(SettleDebtInputSchema) {}
export class ListDebtsQueryDto extends createZodDto(ListDebtsQuerySchema) {}
