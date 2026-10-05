import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  redis,
  service,
  volume,
} from 'railway/iac';

// Whole-project config: `railway config apply` deletes any resource missing from this file,
// so the databases and their volumes stay listed even though nothing here changes them.
export default defineRailway(() => {
  const Postgres = postgres('Postgres', { region: 'sfo' });
  Postgres.networking = { privateNetworkEndpoint: 'postgres' };

  const Redis = redis('Redis', { region: 'sfo' });
  Redis.deploy = {
    startCommand:
      '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"',
  };
  Redis.networking = { privateNetworkEndpoint: 'redis' };

  const volumeAlerts = { usage: { '80': {}, '95': {}, '100': {} } };
  const postgresVolume = volume('postgres-volume', {
    alerts: volumeAlerts,
    allowOnlineResize: true,
    region: 'sfo',
    sizeMB: 500,
  });
  const redisVolume = volume('redis-volume', {
    alerts: volumeAlerts,
    allowOnlineResize: true,
    region: 'sfo',
    sizeMB: 500,
  });

  const finTrack = service('finTrack', {
    source: github('khakimovM/finTrack', { branch: 'main' }),
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
    // Empty start keeps the Dockerfile's CMD.
    start: '',
    preDeploy: 'npx prisma migrate deploy --schema apps/api/prisma/schema.prisma',
    healthcheck: '/api/v1/health/ready',
    // First boot runs migrations and sets the Telegram webhook; two minutes covers both.
    healthcheckTimeout: 120,
    // Restarts on failure (Railway's default policy, stored as null, so not set here) up to 5 times.
    deploy: { restartPolicyMaxRetries: 5 },
    replicas: { sfo: 1 },
    networking: { privateNetworkEndpoint: 'fintrack' },
    // Values live in Railway only; preserve() keeps them without putting secrets in git.
    env: {
      CLIENT_URL: preserve(),
      DATABASE_URL: preserve(),
      GEMINI_API_KEY: preserve(),
      GROQ_API_KEY: preserve(),
      JWT_ACCESS_SECRET: preserve(),
      JWT_REFRESH_SECRET: preserve(),
      NODE_ENV: preserve(),
      OTP_SECRET: preserve(),
      REDIS_URL: preserve(),
      TELEGRAM_BOT_TOKEN: preserve(),
      TELEGRAM_BOT_USERNAME: preserve(),
      TELEGRAM_WEBHOOK_SECRET: preserve(),
      TELEGRAM_WEBHOOK_URL: preserve(),
      WEB_APP_URL: preserve(),
    },
  });

  return project('comfortable-dedication', {
    resources: [finTrack, Postgres, Redis, postgresVolume, redisVolume],
  });
});
