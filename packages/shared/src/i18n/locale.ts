/** The languages the app is written in. */
export const APP_LOCALES = ['uz', 'ru'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

/** A stored or reported language as one the app has: Russian reads as Russian, the rest as Uzbek. */
export function toAppLocale(value: string | null | undefined): AppLocale {
  return value?.trim().toLowerCase().startsWith('ru') ? 'ru' : 'uz';
}

/** The first language of an Accept-Language header the app has; Uzbek when none. */
export function localeFromAcceptLanguage(header: string | null | undefined): AppLocale {
  for (const part of (header ?? '').split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().split('-')[0];
    if (tag === 'uz' || tag === 'ru') return tag;
  }
  return 'uz';
}
