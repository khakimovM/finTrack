import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Who may open the admin panel: the Telegram ids in ADMIN_TELEGRAM_IDS, and nobody else. The list
 * lives in the environment, not in the database, so no data bug or SQL access can grant it.
 */
@Injectable()
export class AdminAccessService {
  private readonly ids: ReadonlySet<bigint>;

  constructor(config: ConfigService) {
    this.ids = parseAdminIds(config.get<string>('ADMIN_TELEGRAM_IDS'));
  }

  /** Without any admin id the whole panel behaves as if it did not exist. */
  get enabled(): boolean {
    return this.ids.size > 0;
  }

  isAdmin(telegramId: bigint | null | undefined): boolean {
    return telegramId !== null && telegramId !== undefined && this.ids.has(telegramId);
  }
}

export function parseAdminIds(raw: string | undefined): ReadonlySet<bigint> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => /^\d+$/.test(part))
      .map((part) => BigInt(part)),
  );
}
