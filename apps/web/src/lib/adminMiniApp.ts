import axios from 'axios';
import { AdminWebAppSessionResponse } from '@fintrack/shared';
import type { TelegramWebApp } from './telegram';
import { miniAppStatusFor } from './miniAppAuth';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { useMiniAppStore } from '../stores/miniAppStore';
import { useUiStore } from '../stores/uiStore';

/** The admin panel's pages: inside Telegram they sign in as the admin, not as a user. */
export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * The bot's /admin button opens the panel as a Mini App. Cookies are unreliable in Telegram's
 * webview, so the admin session token lives in memory only and goes out in the X-Admin-Token
 * header. Nothing is stored: a reload or a new launch signs in afresh from the bot.
 */
let adminToken: string | null = null;
let inTelegram = false;

export function adminMiniAppToken(): string | null {
  return adminToken;
}

/** The panel runs inside Telegram: it ends by closing, not by going to /admin/login. */
export function isAdminMiniApp(): boolean {
  return inTelegram;
}

export function forgetAdminMiniAppToken(): void {
  adminToken = null;
}

/** Runs before the first render, like the user Mini App's sign-in. */
export async function signInAdminMiniApp(app: TelegramWebApp): Promise<void> {
  const { setStatus } = useMiniAppStore.getState();
  inTelegram = true;
  useUiStore.getState().followTelegramTheme(app.colorScheme);
  app.onEvent('themeChanged', () => useUiStore.getState().followTelegramTheme(app.colorScheme));

  if (!app.initData) {
    setStatus('no-init-data');
    return;
  }
  try {
    // A bare axios call: the shared client's 401 handling is for user sessions.
    const res = await axios.post<{ data: AdminWebAppSessionResponse }>(
      '/api/v1/admin/auth/telegram/webapp',
      { initData: app.initData },
      { headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } },
    );
    const { token, ...session } = res.data.data;
    adminToken = token;
    queryClient.setQueryData(queryKeys.admin.session(), session);
    setStatus('ready');
  } catch (error) {
    // Not an admin: the panel shows its 404 page, exactly as it does in a browser.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      setStatus('ready');
      return;
    }
    setStatus(miniAppStatusFor(error));
  }
}
