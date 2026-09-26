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
import { validateEnv } from './config/env.validation';

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
  // The adapter is built before Nest's ConfigService exists; importing AppModule has
  // already loaded .env, so validate here to read the proxy setting safely.
  const env = validateEnv(process.env);

  // Railway and Vercel terminate TLS and forward the client IP; without trustProxy every
  // request looks like it comes from the proxy, which breaks throttling and session IPs.
  const adapter = new FastifyAdapter({
    logger: false,
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
  });

  // Third-party typing mismatch between @nestjs/platform-fastify and the fastify plugins:
  // the adapter's register() expects its own FastifyInstance type without plugin augmentations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await adapter.register(fastifyHelmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Swagger UI needs its own assets when it is enabled.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await adapter.register(fastifyCookie as any);

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.enableCors({
    origin: [configService.get<string>('CLIENT_URL', 'http://localhost:5173')],
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

  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED') ?? !isProduction;
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FinTrack API')
      .setDescription('FinTrack shaxsiy moliya platformasi API hujjati')
      .setVersion('1.0')
      .addCookieAuth('accessToken')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 5000);
  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`Server listening at http://0.0.0.0:${port}`);
}

bootstrap().catch((err: unknown) => {
  // Logger may not be ready yet; fail loudly so the platform restarts the container.
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
