import { Global, Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';

/** Global so any module can send Telegram messages without importing the bot's handlers. */
@Global()
@Module({
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramCoreModule {}
