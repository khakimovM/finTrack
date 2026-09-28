import { TelegramWebApp } from '../../lib/telegram';
import { exchangeInitData, miniAppStatusFor } from '../../lib/miniAppAuth';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useMiniAppStore } from '../../stores/miniAppStore';
import { useUiStore } from '../../stores/uiStore';

/** Runs before the first render so the app starts signed in and in Telegram's colours. */
export async function signInMiniApp(app: TelegramWebApp): Promise<void> {
  const { setStatus } = useMiniAppStore.getState();
  useUiStore.getState().followTelegramTheme(app.colorScheme);
  app.onEvent('themeChanged', () => useUiStore.getState().followTelegramTheme(app.colorScheme));

  if (!app.initData) {
    setStatus('no-init-data');
    return;
  }
  try {
    const { user } = await exchangeInitData(app.initData);
    useAuthStore.getState().signIn(user);
    queryClient.setQueryData(queryKeys.auth.me(), user);
    setStatus('ready');
  } catch (error) {
    setStatus(miniAppStatusFor(error));
  }
}
