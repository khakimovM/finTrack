import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { AdminAuditQuerySchema } from '@fintrack/shared';
import { AdminOnly } from '../admin.guard';
import { AdminSystemService } from './admin-system.service';
import { AdminAuditLogService } from './admin-audit-log.service';

class AdminAuditQueryDto extends createZodDto(AdminAuditQuerySchema) {}

@ApiTags('admin')
@AdminOnly()
@Controller('admin')
export class AdminSystemController {
  constructor(
    private readonly system: AdminSystemService,
    private readonly auditLog: AdminAuditLogService,
  ) {}

  @Get('system')
  @ApiOperation({ summary: 'Tizim holati: DB, Redis, navbatlar, Telegram, versiya' })
  status() {
    return this.system.status();
  }

  @Get('audit')
  @ApiOperation({ summary: 'Admin amallari jurnali' })
  audit(@Query() query: AdminAuditQueryDto) {
    return this.auditLog.list(query);
  }
}
