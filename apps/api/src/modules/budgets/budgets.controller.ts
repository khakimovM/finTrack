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
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, UpdateBudgetDto, ListBudgetsQueryDto } from './dto/budget.dto';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller({ path: 'budgets', version: '1' })
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Oy bo‘yicha byudjetlar ro‘yxati' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListBudgetsQueryDto,
  ) {
    return this.service.list(userId, query.month);
  }

  @Get('status')
  @ApiOperation({ summary: 'Byudjetlarning sarflanish holati (progress va ogohlantirishlar bilan)' })
  async getStatus(
    @CurrentUser('id') userId: string,
    @Query() query: ListBudgetsQueryDto,
  ) {
    return this.service.getStatus(userId, query.month);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kategoriya uchun oylik byudjet belgilash' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Byudjet limitini yangilash' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Byudjetni o‘chirish' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.delete(userId, id);
  }
}
