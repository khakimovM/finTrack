import { createHmac, timingSafeEqual } from 'crypto';

export interface InitDataUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export type InitDataResult =
  | { ok: true; user: InitDataUser; authDate: number; hash: string }
  | { ok: false; reason: 'invalid' | 'expired' };

/** Tolerated clock difference between Telegram's servers and ours. */
const CLOCK_SKEW_SECONDS = 60;

function dataCheckString(params: URLSearchParams, exclude: string[]): string {
  return [...params.entries()]
    .filter(([key]) => !exclude.includes(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function parseUser(raw: string | null): InitDataUser | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as Record<string, unknown>;
    if (!Number.isSafeInteger(user.id) || (user.id as number) <= 0 || user.is_bot === true) return null;
    if (typeof user.first_name !== 'string') return null;
    return {
      id: user.id as number,
      firstName: user.first_name,
      lastName: typeof user.last_name === 'string' ? user.last_name : undefined,
      username: typeof user.username === 'string' ? user.username : undefined,
      languageCode: typeof user.language_code === 'string' ? user.language_code : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies `Telegram.WebApp.initData` (https://core.telegram.org/bots/webapps): the hash is
 * HMAC-SHA256 of the sorted "key=value" lines under the key HMAC-SHA256("WebAppData", botToken).
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): InitDataResult {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: 'invalid' };

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const signedBy = (exclude: string[]) =>
    timingSafeEqual(createHmac('sha256', secret).update(dataCheckString(params, exclude)).digest(), Buffer.from(hash, 'hex'));
  // Telegram's docs disagree on whether the newer `signature` field is part of the string for
  // the bot-token check. Both variants are keyed by the bot token, so either one proves origin.
  const authentic = signedBy(['hash']) || (params.has('signature') && signedBy(['hash', 'signature']));
  if (!authentic) return { ok: false, reason: 'invalid' };

  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate <= 0) return { ok: false, reason: 'invalid' };
  if (authDate > nowSeconds + CLOCK_SKEW_SECONDS || nowSeconds - authDate > maxAgeSeconds) {
    return { ok: false, reason: 'expired' };
  }

  const user = parseUser(params.get('user'));
  if (!user) return { ok: false, reason: 'invalid' };
  return { ok: true, user, authDate, hash };
}
