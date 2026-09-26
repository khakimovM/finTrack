import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/transfer.dto';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller({ path: 'transfers', version: '1' })
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Hisoblararo pul o‘tkazish (bitta atomik tranzaksiya)' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'O‘tkazmani o‘chirish (ikkala bog‘liq yozuv soft delete bo‘ladi)' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
  ) {
    await this.service.delete(userId, groupId);
  }
}
