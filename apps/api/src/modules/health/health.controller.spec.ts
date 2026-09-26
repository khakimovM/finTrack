import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([1]),
  };

  const mockRedis = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return status ok for liveness check', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('should return ok for readiness check when dependencies are healthy', async () => {
    const res = await controller.ready();
    expect(res).toEqual({ status: 'ok', db: 'ok', redis: 'ok' });
  });

  it('should fail with 503 SERVICE_UNAVAILABLE if db is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
    await expect(controller.ready()).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      details: { db: 'down', redis: 'ok' },
    });
  });

  it('should fail with 503 if redis does not answer PONG', async () => {
    mockRedis.ping.mockResolvedValueOnce('NOT_CONNECTED');
    await expect(controller.ready()).rejects.toMatchObject({ status: 503, details: { redis: 'down' } });
  });
});
