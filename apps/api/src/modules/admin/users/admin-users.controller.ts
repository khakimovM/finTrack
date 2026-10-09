import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { AdminBanUserSchema, AdminUsersExportQuerySchema, AdminUsersQuerySchema } from '@fintrack/shared';
import { requestMeta } from '../../auth/auth.controller';
import { AdminOnly, CurrentAdmin } from '../admin.guard';
import { AdminPrincipal } from '../admin-session.service';
import { ActionContext, AdminUsersService } from './admin-users.service';

class AdminUsersQueryDto extends createZodDto(AdminUsersQuerySchema) {}
class AdminUsersExportQueryDto extends createZodDto(AdminUsersExportQuerySchema) {}
class AdminBanUserDto extends createZodDto(AdminBanUserSchema) {}

const context = (admin: AdminPrincipal, req: FastifyRequest): ActionContext => ({
  admin,
  ipAddress: requestMeta(req).ipAddress ?? null,
});

@ApiTags('admin')
@AdminOnly()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Foydalanuvchilar ro‘yxati (qidiruv, holat, saralash)' })
  list(@Query() query: AdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Get('export.csv')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Ro‘yxatni CSV qilib yuklab olish (audit’ga yoziladi)' })
  async export(
    @Query() query: AdminUsersExportQueryDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const csv = await this.users.exportCsv(query, context(admin, req));
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="fintrack-users.csv"');
    res.header('Cache-Control', 'no-store');
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Foydalanuvchi: profil, sanoqlar va 90 kunlik faollik' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.detail(id);
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bloklash: kira olmaydi, barcha sessiyalari tugaydi' })
  ban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminBanUserDto,
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: FastifyRequest,
  ) {
    return this.users.ban(id, dto.reason, context(admin, req));
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Blokdan chiqarish' })
  unban(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() admin: AdminPrincipal, @Req() req: FastifyRequest) {
    return this.users.unban(id, context(admin, req));
  }

  @Post(':id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Barcha sessiyalarini tugatish (qayta kira oladi)' })
  revokeSessions(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() admin: AdminPrincipal, @Req() req: FastifyRequest) {
    return this.users.revokeSessions(id, context(admin, req));
  }
}
