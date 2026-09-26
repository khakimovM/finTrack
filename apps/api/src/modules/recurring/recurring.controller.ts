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
import { RecurringService } from './recurring.service';
import {
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  ListRecurringRulesQueryDto,
} from './dto/recurring.dto';

@ApiTags('recurring')
@ApiBearerAuth()
@Controller({ path: 'recurring', version: '1' })
export class RecurringController {
  constructor(private readonly service: RecurringService) {}

  @Get()
  @ApiOperation({ summary: 'Takrorlanuvchi to‘lovlar ro‘yxati' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListRecurringRulesQueryDto,
  ) {
    return this.service.list(userId, query.isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Takrorlanuvchi to‘lov qoidasi tafsiloti' })
  async getById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi takrorlanuvchi to‘lov qoidasi yaratish' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRecurringRuleDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Takrorlanuvchi to‘lov qoidasini tahrirlash' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringRuleDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Takrorlanuvchi to‘lov qoidasini o‘chirish' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.delete(userId, id);
  }

  @Post(':id/run-now')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Qoidani darhol ishga tushirish (tranzaksiya yaratish)' })
  async runNow(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.runNow(userId, id);
  }
}
