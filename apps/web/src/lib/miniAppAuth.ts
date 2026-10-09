import axios from 'axios';
import { TelegramWebAppAuthResponse } from '@fintrack/shared';
import type { MiniAppStatus } from '../stores/miniAppStore';

/**
 * Inside Telegram the session lives in memory only: cookies are unreliable in Telegram's
 * webview, and the signed initData can be exchanged again whenever the token expires.
 */
let initData: string | null = null;
let accessToken: string | null = null;
let pending: Promise<TelegramWebAppAuthResponse> | null = null;

export function miniAppStatusFor(error: unknown): MiniAppStatus {
  const code = axios.isAxiosError(error)
    ? (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code
    : undefined;
  if (code === 'TELEGRAM_NOT_REGISTERED') return 'unregistered';
  if (code === 'ACCOUNT_BANNED') return 'banned';
  if (code === 'TELEGRAM_INIT_DATA_EXPIRED') return 'expired';
  return 'error';
}

export function isMiniAppSession(): boolean {
  return initData !== null;
}

export function miniAppAccessToken(): string | null {
  return accessToken;
}

/**
 * Single-flight: parallel 401s share one exchange. Uses a bare axios call because the shared
 * client's 401 handling would otherwise call back into this function.
 */
export function exchangeInitData(data?: string): Promise<TelegramWebAppAuthResponse> {
  if (data) initData = data;
  if (!initData) return Promise.reject(new Error('Telegram initData is missing'));

  pending ??= axios
    .post<{ data: TelegramWebAppAuthResponse }>(
      '/api/v1/auth/telegram/webapp',
      { initData },
      { headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } },
    )
    .then((res) => {
      accessToken = res.data.data.accessToken;
      return res.data.data;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
