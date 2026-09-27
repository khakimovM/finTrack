import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramLifecycleService } from './telegram-lifecycle.service';
import { AuthHandlers } from './handlers/auth.handlers';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramLifecycleService, AuthHandlers],
})
export class TelegramModule {}
