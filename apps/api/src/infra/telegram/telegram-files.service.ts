import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBotService } from './telegram-bot.service';

export class TelegramFileError extends Error {
  constructor(readonly reason: 'disabled' | 'too-large' | 'failed') {
    super(`Telegram file download: ${reason}`);
    this.name = 'TelegramFileError';
  }
}

const DOWNLOAD_TIMEOUT_MS = 20_000;

/** Downloads files users send to the bot (voice notes). */
@Injectable()
export class TelegramFilesService {
  private readonly apiRoot: string;
  private readonly token?: string;

  constructor(
    private readonly telegram: TelegramBotService,
    config: ConfigService,
  ) {
    this.apiRoot = config.get<string>('TELEGRAM_API_ROOT') ?? 'https://api.telegram.org';
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN');
  }

  async download(fileId: string, maxBytes: number): Promise<Buffer> {
    const bot = this.telegram.bot;
    if (!bot || !this.token) throw new TelegramFileError('disabled');

    const file = await bot.api.getFile(fileId).catch(() => null);
    if (!file?.file_path) throw new TelegramFileError('failed');
    if (file.file_size !== undefined && file.file_size > maxBytes) throw new TelegramFileError('too-large');

    // The URL embeds the bot token: it must never reach a log or an error message.
    let res: Response;
    try {
      res = await fetch(`${this.apiRoot}/file/bot${this.token}/${file.file_path}`, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
    } catch {
      throw new TelegramFileError('failed');
    }
    if (!res.ok) throw new TelegramFileError('failed');

    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > maxBytes) throw new TelegramFileError('too-large');
    return data;
  }
}
