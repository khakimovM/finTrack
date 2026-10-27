import type { AppLocale } from '@fintrack/shared';
import { useLocaleStore } from '../../stores/localeStore';

/** The landing page in each language: "/" is Uzbek and the default, "/ru" Russian. */
export const LANDING_PATH: Record<AppLocale, string> = { uz: '/', ru: '/ru' };

/**
 * Opening /ru (a search result, a shared link) makes Russian the site's language before the first
 * render, so the app draws the same page the prerendered HTML shows. "/" keeps the language chosen
 * earlier: public/locale-init.js has already sent a Russian visitor on to /ru.
 */
export function followAddressLanguage(): void {
  if (window.location.pathname.replace(/\/+$/, '') === LANDING_PATH.ru) useLocaleStore.getState().setLocale('ru');
}
