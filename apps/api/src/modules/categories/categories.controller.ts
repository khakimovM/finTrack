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
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
  ListCategoriesQueryDto,
} from './dto/category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Kategoriyalar daraxtini olish (INCOME / EXPENSE)' })
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListCategoriesQueryDto,
  ) {
    return this.service.list(userId, query.type);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yangi kategoriya yaratish' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Kategoriyalar tartibini o‘zgartirish' })
  async reorder(
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderCategoriesDto,
  ) {
    await this.service.reorder(userId, dto);
    return { message: 'Kategoriyalar tartibi muvaffaqiyatli yangilandi' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kategoriyani ID bo‘yicha olish' })
  async getById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getById(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Kategoriyani tahrirlash' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kategoriyani o‘chirish (tizim kategoriyasi bo‘lmasa)' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.delete(userId, id);
  }
}
