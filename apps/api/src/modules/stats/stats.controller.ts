import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StatsService } from './stats.service';
import {
  StatsSummaryQueryDto,
  StatsTimeseriesQueryDto,
  StatsByCategoryQueryDto,
  StatsByAccountQueryDto,
  StatsBalanceTrendQueryDto,
  StatsCompareQueryDto,
} from './dto/stats.dto';

@ApiTags('stats')
@ApiBearerAuth()
@Controller({ path: 'stats', version: '1' })
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Moliyaviy xulosa (KPI kartalar, umumiy balans, o‘tgan davr bilan farq)' })
  async getSummary(
    @CurrentUser('id') userId: string,
    @Query() query: StatsSummaryQueryDto,
  ) {
    return this.statsService.getSummary(userId, query);
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Kirim va chiqim dinamikasi (nol bilan to‘ldirilgan bucketlar)' })
  async getTimeseries(
    @CurrentUser('id') userId: string,
    @Query() query: StatsTimeseriesQueryDto,
  ) {
    return this.statsService.getTimeseries(userId, query);
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Kategoriyalar bo‘yicha taqsimot (ierarxiya va foizlar bilan)' })
  async getByCategory(
    @CurrentUser('id') userId: string,
    @Query() query: StatsByCategoryQueryDto,
  ) {
    return this.statsService.getByCategory(userId, query);
  }

  @Get('by-account')
  @ApiOperation({ summary: 'Hisoblar bo‘yicha statistika (har bir hisob balansi va aylanmasi)' })
  async getByAccount(
    @CurrentUser('id') userId: string,
    @Query() query: StatsByAccountQueryDto,
  ) {
    return this.statsService.getByAccount(userId, query);
  }

  @Get('balance-trend')
  @ApiOperation({ summary: 'Balans trendi (kunlik uzluksiz kumulyativ balans egri chizig‘i)' })
  async getBalanceTrend(
    @CurrentUser('id') userId: string,
    @Query() query: StatsBalanceTrendQueryDto,
  ) {
    return this.statsService.getBalanceTrend(userId, query);
  }

  @Get('debts')
  @ApiOperation({ summary: 'Qarzlar statistikasi (berilgan, olingan, saldo va muddati o‘tganlar)' })
  async getDebts(@CurrentUser('id') userId: string) {
    return this.statsService.getDebts(userId);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Ikki davrni solishtirish (kirim/chiqim o‘zgarish foizlari va kategoriyalar)' })
  async getCompare(
    @CurrentUser('id') userId: string,
    @Query() query: StatsCompareQueryDto,
  ) {
    return this.statsService.getCompare(userId, query);
  }
}
