import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// Invariant: BigInt is always serialized to JSON as a string.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export function createFastifyAdapter(trustProxy: boolean | number): FastifyAdapter {
  // Railway and Vercel terminate TLS and forward the client IP; without trustProxy every
  // request looks like it comes from the proxy, which breaks throttling and session IPs.
  return new FastifyAdapter({ logger: false, trustProxy, bodyLimit: 1024 * 1024 });
}

/** Everything main.ts and the e2e harness must configure identically. */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  // Third-party typing mismatch between @nestjs/platform-fastify and the fastify plugins:
  // register() expects its own FastifyInstance type without plugin augmentations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Swagger UI needs its own inline assets when it is enabled.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyCookie as any);

  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.enableCors({
    origin: [config.get<string>('CLIENT_URL', 'http://localhost:5173')],
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  if (config.get<boolean>('SWAGGER_ENABLED') ?? !isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FinTrack API')
      .setDescription('FinTrack shaxsiy moliya platformasi API hujjati')
      .setVersion('1.0')
      .addCookieAuth('accessToken')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  app.enableShutdownHooks();
}
