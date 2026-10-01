/** The part of `Telegram.WebApp` FinTrack uses (https://core.telegram.org/bots/webapps). */
export interface TelegramWebApp {
  initData: string;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(version: string): boolean;
  disableVerticalSwipes?(): void;
  onEvent(event: 'themeChanged', handler: () => void): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js?63';
const SCRIPT_TIMEOUT_MS = 8000;
/** Where telegram-web-app.js keeps the launch parameters, so a reload stays a Mini App. */
const STORED_LAUNCH_PARAMS = '__telegram__initParams';

let current: TelegramWebApp | null = null;

/** The Mini App this page runs in, or null in a normal browser tab. */
export function telegramApp(): TelegramWebApp | null {
  return current;
}

/** Telegram opens a Mini App with `tgWebApp…` launch parameters in the URL fragment. */
export function hasLaunchParams(hash: string): boolean {
  return /(^|[#&])tgWebApp(Data|Version|Platform)=/.test(hash);
}

function launchedFromTelegram(): boolean {
  if (hasLaunchParams(window.location.hash)) return true;
  try {
    return sessionStorage.getItem(STORED_LAUNCH_PARAMS) !== null;
  } catch {
    return false;
  }
}

function loadScript(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => resolve(null), SCRIPT_TIMEOUT_MS);
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      resolve(window.Telegram?.WebApp ?? null);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    document.head.appendChild(script);
  });
}

/**
 * Loads Telegram's script only inside Telegram, so regular visitors do not pay for it. Must run
 * before the router starts: the script reads the launch parameters from the URL fragment.
 */
export async function startTelegram(): Promise<TelegramWebApp | null> {
  if (!launchedFromTelegram()) return null;
  const app = await loadScript();
  if (!app) return null;

  app.ready();
  app.expand();
  // Charts and lists scroll vertically; without this a swipe down closes the app.
  if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
  current = app;
  return app;
}
