import { Global, Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramFilesService } from './telegram-files.service';

/** Global so any module can send Telegram messages without importing the bot's handlers. */
@Global()
@Module({
  providers: [TelegramBotService, TelegramFilesService],
  exports: [TelegramBotService, TelegramFilesService],
})
export class TelegramCoreModule {}
