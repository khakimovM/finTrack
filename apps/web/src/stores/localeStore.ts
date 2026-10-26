import { create } from 'zustand';
import { AppLocale, toAppLocale } from '@fintrack/shared';

const STORAGE_KEY = 'fintrack.locale';

function storedLocale(): AppLocale {
  try {
    return toAppLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Prerender (no window) or blocked storage: the default language.
    return 'uz';
  }
}

function markDocument(locale: AppLocale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

interface LocaleState {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

/** The language of this device; a signed-in user's choice is also kept on the account. */
export const useLocaleStore = create<LocaleState>((set) => {
  const initial = storedLocale();
  markDocument(initial);
  return {
    locale: initial,
    setLocale: (locale) => {
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // Kept for this visit only.
      }
      markDocument(locale);
      set({ locale });
    },
  };
});
