import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { CacheModule } from './infra/redis/cache.module';
import { ClockModule } from './infra/clock/clock.module';
import { TelegramCoreModule } from './infra/telegram/telegram-core.module';
import { redisConnectionOptions } from './infra/redis/redis-connection';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { DebtsModule } from './modules/debts/debts.module';
import { StatsModule } from './modules/stats/stats.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RecurringModule } from './modules/recurring/recurring.module';
import { ExportModule } from './modules/export/export.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { UsersModule } from './modules/users/users.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { AdminModule } from './modules/admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';

// Tokens and cookies must never reach the logs (60-security.md).
const REDACTED_LOG_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-telegram-bot-api-secret-token"]',
  'res.headers["set-cookie"]',
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    JwtModule.register({
      global: true,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: config.get<string>('LOG_LEVEL') ?? (isProduction ? 'info' : 'debug'),
            redact: { paths: REDACTED_LOG_PATHS, censor: '[REDACTED]' },
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                },
            autoLogging: {
              ignore: (req) => (req.url ?? '').startsWith('/api/v1/health'),
            },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          // @nestjs/throttler v5 measures ttl in milliseconds; the env value is in seconds.
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    PrismaModule,
    CacheModule,
    ClockModule,
    TelegramCoreModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionOptions(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
      }),
    }),
    HealthModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TagsModule,
    TransactionsModule,
    TransfersModule,
    DebtsModule,
    StatsModule,
    BudgetsModule,
    NotificationsModule,
    RecurringModule,
    ExportModule,
    JobsModule,
    UsersModule,
    TelegramModule,
    AdminModule,
  ],

  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
