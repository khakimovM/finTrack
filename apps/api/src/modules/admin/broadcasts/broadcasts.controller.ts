import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import {
  BroadcastAudienceSchema,
  BroadcastListQuerySchema,
  BroadcastTestSchema,
  CreateBroadcastSchema,
} from '@fintrack/shared';
import { requestMeta } from '../../auth/auth.controller';
import { AdminOnly, CurrentAdmin } from '../admin.guard';
import { AdminPrincipal } from '../admin-session.service';
import { ActionContext } from '../users/admin-users.service';
import { BroadcastsService } from './broadcasts.service';

class BroadcastAudienceDto extends createZodDto(BroadcastAudienceSchema) {}
class BroadcastTestDto extends createZodDto(BroadcastTestSchema) {}
class CreateBroadcastDto extends createZodDto(CreateBroadcastSchema) {}
class BroadcastListQueryDto extends createZodDto(BroadcastListQuerySchema) {}

const context = (admin: AdminPrincipal, req: FastifyRequest): ActionContext => ({
  admin,
  ipAddress: requestMeta(req).ipAddress ?? null,
});

@ApiTags('admin')
@AdminOnly()
@Controller('admin/broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xabar kimga borishi: aniq son va chiqarib tashlanganlar' })
  preview(@Body() dto: BroadcastAudienceDto) {
    return this.broadcasts.preview(dto);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Matnni faqat adminning o‘ziga yuborish' })
  test(@Body() dto: BroadcastTestDto, @CurrentAdmin() admin: AdminPrincipal, @Req() req: FastifyRequest) {
    return this.broadcasts.test(dto.text, context(admin, req));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Xabarni tarqatish (avval test, aniq qabul qiluvchilar soni bilan)' })
  create(@Body() dto: CreateBroadcastDto, @CurrentAdmin() admin: AdminPrincipal, @Req() req: FastifyRequest) {
    return this.broadcasts.create(dto, context(admin, req));
  }

  @Get()
  @ApiOperation({ summary: 'Tarqatilgan xabarlar, eng yangisi birinchi' })
  list(@Query() query: BroadcastListQueryDto) {
    return this.broadcasts.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta xabar: holati va natijasi' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.broadcasts.get(id);
  }
}
