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
import { AccountsService } from './accounts.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  ReorderAccountsDto,
  ListAccountsQueryDto,
} from './dto/account.dto';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Hisoblar ro‘yxatini olish (balanslar bilan)' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListAccountsQueryDto,
  ) {
    return this.service.list(userId, query.includeArchived === 'true');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi hisob yaratish' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Hisoblar tartibini o‘zgartirish' })
  async reorder(
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderAccountsDto,
  ) {
    await this.service.reorder(userId, dto);
    return { message: 'Hisoblar tartibi muvaffaqiyatli yangilandi' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Hisobni ID bo‘yicha olish' })
  async getById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Hisobni tahrirlash' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Hisobni arxivlash yoki arxivdan chiqarish' })
  async archive(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.toggleArchive(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tarixsiz hisobni o‘chirish (tarixi bor hisob arxivlanadi)' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.delete(userId, id);
  }
}
