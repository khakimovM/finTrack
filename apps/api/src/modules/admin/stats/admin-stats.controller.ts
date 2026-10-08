import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { AdminGrowthQuerySchema, AdminPeriodQuerySchema, AdminRetentionQuerySchema } from '@fintrack/shared';
import { AdminOnly } from '../admin.guard';
import { AdminStatsService } from './admin-stats.service';

class AdminGrowthQueryDto extends createZodDto(AdminGrowthQuerySchema) {}
class AdminRetentionQueryDto extends createZodDto(AdminRetentionQuerySchema) {}
class AdminPeriodQueryDto extends createZodDto(AdminPeriodQuerySchema) {}

/** Statistics across all users for the admin panel: counts and dates only. */
@ApiTags('admin')
@AdminOnly()
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Foydalanuvchilar va yozuvlar: jami, yangi, faol (bugun / 7 / 30 kun)' })
  overview() {
    return this.stats.overview();
  }

  @Get('growth')
  @ApiOperation({ summary: 'O‘sish: yangi, jami ro‘yxatdan o‘tgan, faol foydalanuvchilar va yozuvlar' })
  growth(@Query() query: AdminGrowthQueryDto) {
    return this.stats.growth(query);
  }

  @Get('retention')
  @ApiOperation({ summary: 'Haftalik kogortalar: ro‘yxatdan o‘tgan haftadan keyin 0–8 hafta qaytganlar' })
  retention(@Query() query: AdminRetentionQueryDto) {
    return this.stats.retention(query);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Kanallar, funksiyalar va ovozli yordamchidan foydalanish' })
  usage(@Query() query: AdminPeriodQueryDto) {
    return this.stats.usage(query);
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Voronka: ro‘yxatdan o‘tish → birinchi yozuv → 5 yozuv → 2-haftada qaytish' })
  funnel(@Query() query: AdminPeriodQueryDto) {
    return this.stats.funnel(query);
  }
}
