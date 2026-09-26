import { createZodDto } from 'nestjs-zod';
import {
  StatsSummaryQuerySchema,
  StatsTimeseriesQuerySchema,
  StatsByCategoryQuerySchema,
  StatsByAccountQuerySchema,
  StatsBalanceTrendQuerySchema,
  StatsCompareQuerySchema,
} from '@fintrack/shared';

export class StatsSummaryQueryDto extends createZodDto(StatsSummaryQuerySchema) {}
export class StatsTimeseriesQueryDto extends createZodDto(StatsTimeseriesQuerySchema) {}
export class StatsByCategoryQueryDto extends createZodDto(StatsByCategoryQuerySchema) {}
export class StatsByAccountQueryDto extends createZodDto(StatsByAccountQuerySchema) {}
export class StatsBalanceTrendQueryDto extends createZodDto(StatsBalanceTrendQuerySchema) {}
export class StatsCompareQueryDto extends createZodDto(StatsCompareQuerySchema) {}
