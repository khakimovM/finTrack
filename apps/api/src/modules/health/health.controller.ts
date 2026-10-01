import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheckResponse } from '@fintrack/shared';
import { Public } from '../../common/decorators/public.decorator';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

type DependencyStatus = 'ok' | 'down';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Basic liveness check' })
  @ApiResponse({ status: 200, description: 'Liveness status' })
  check(): HealthCheckResponse {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check with database and cache' })
  @ApiResponse({ status: 200, description: 'All dependencies are reachable' })
  @ApiResponse({ status: 503, description: 'A dependency is down' })
  async ready(): Promise<{ status: 'ok'; db: DependencyStatus; redis: DependencyStatus }> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);

    // Load balancers and Railway healthchecks only look at the status code.
    if (db !== 'ok' || redis !== 'ok') {
      throw new DomainException('Xizmat vaqtincha tayyor emas', 'SERVICE_UNAVAILABLE', HttpStatus.SERVICE_UNAVAILABLE, {
        db,
        redis,
      });
    }
    return { status: 'ok', db, redis };
  }

  private async checkDb(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      return (await this.redis.ping()) === 'PONG' ? 'ok' : 'down';
    } catch {
      return 'down';
    }
  }
}
