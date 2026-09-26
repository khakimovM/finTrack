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
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  ListTransactionsQueryDto,
  BulkDeleteTransactionsDto,
} from './dto/transaction.dto';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Tranzaksiyalar ro‘yxatini olish (filtr, saralash, sahifalash va meta.sums)' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.service.list(userId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi tranzaksiya yaratish (INCOME yoki EXPENSE)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tranzaksiyalarni ommaviy o‘chirish' })
  async bulkDelete(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkDeleteTransactionsDto,
  ) {
    await this.service.bulkDelete(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tranzaksiyani ID bo‘yicha olish' })
  async getById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Tranzaksiyani tahrirlash' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tranzaksiyani o‘chirish (soft delete)' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.delete(userId, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'O‘chirilgan tranzaksiyani tiklash' })
  async restore(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restore(userId, id);
  }
}
