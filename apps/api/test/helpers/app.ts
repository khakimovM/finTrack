import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { configureApp, createFastifyAdapter } from '../../src/bootstrap/configure-app';
import { PrismaService } from '../../src/infra/prisma/prisma.service';

export interface TestApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(1));
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    prisma: app.get(PrismaService),
    close: () => app.close(),
  };
}
