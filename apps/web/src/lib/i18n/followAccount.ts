import { toAppLocale } from '@fintrack/shared';
import { useAuthStore } from '../../stores/authStore';
import { useLocaleStore } from '../../stores/localeStore';

/** A signed-in user gets the language kept on their account, whichever device they open. */
export function followAccountLanguage(): () => void {
  return useAuthStore.subscribe((state, previous) => {
    const locale = state.user?.locale;
    if (!locale || locale === previous.user?.locale) return;
    useLocaleStore.getState().setLocale(toAppLocale(locale));
  });
}
