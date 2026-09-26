import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DebtsService } from './debts.service';
import { DebtPaymentsService } from './debt-payments.service';
import {
  CreateDebtDto,
  UpdateDebtDto,
  CreateDebtPaymentDto,
  SettleDebtDto,
  ListDebtsQueryDto,
} from './dto/debt.dto';

@ApiTags('debts')
@ApiBearerAuth()
@Controller({ path: 'debts', version: '1' })
export class DebtsController {
  constructor(
    private readonly service: DebtsService,
    private readonly payments: DebtPaymentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Qarzlar ro‘yxatini olish (filtrlar, sahifalash va summary bilan)' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListDebtsQueryDto,
  ) {
    return this.service.list(userId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi qarz yaratish (ledger yozuvi bilan atomik)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDebtDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Qarzni ID bo‘yicha olish' })
  async getById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Qarz ma‘lumotlarini tahrirlash' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Qarzni o‘chirish (bog‘liq ledger yozuvlari bilan birga soft delete)' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.delete(userId, id);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Qarz bo‘yicha qilingan to‘lovlar ro‘yxati' })
  async listPayments(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.listPayments(userId, id);
  }

  @Post(':id/payments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Qarzga qisman to‘lov kiritish (ledger yozuvi bilan atomik)' })
  async createPayment(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDebtPaymentDto,
  ) {
    return this.payments.createPayment(userId, id, dto);
  }

  @Post(':id/settle')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Qarzni to‘liq yopish' })
  async settle(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleDebtDto,
  ) {
    return this.payments.settle(userId, id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @ApiOperation({ summary: 'Qarz to‘lovini bekor qilish (ledger yozuvi ham qaytariladi)' })
  async deletePayment(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.payments.deletePayment(userId, id, paymentId);
  }
}
