import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// Invariant: BigInt is always serialized to JSON as a string
BigInt.prototype.toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const adapter = new FastifyAdapter({ logger: false });
  // Note: Third-party typing mismatch between @nestjs/platform-fastify and @fastify/cookie / @fastify/helmet.
  // FastifyAdapter register parameter expects its internal FastifyInstance without external plugin augmentations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await adapter.register(fastifyHelmet as any, {
    contentSecurityPolicy: false,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await adapter.register(fastifyCookie as any);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { bufferLogs: true },
  );

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const clientUrl = configService.get<string>('CLIENT_URL', 'http://localhost:5173');

  app.enableCors({
    origin: [clientUrl],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FinTrack API')
    .setDescription('FinTrack shaxsiy moliya platformasi API hujjati')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 5000);
  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`Server listening at http://0.0.0.0:${port}`);
}

bootstrap();
