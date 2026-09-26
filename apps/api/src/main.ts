import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';
import { configureApp, createFastifyAdapter } from './bootstrap/configure-app';

async function bootstrap() {
  // The adapter is built before Nest's ConfigService exists; importing AppModule has
  // already loaded .env, so validate here to read the proxy setting safely.
  const env = validateEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(env.TRUST_PROXY),
    { bufferLogs: true },
  );

  const logger = app.get(Logger);
  app.useLogger(logger);
  await configureApp(app);

  const port = app.get(ConfigService).get<number>('PORT', 5000);
  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`Server listening at http://0.0.0.0:${port}`);
}

bootstrap().catch((err: unknown) => {
  // The logger may not be ready yet; fail loudly so the platform restarts the container.
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
