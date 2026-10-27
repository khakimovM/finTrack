import { AppLocale, toAppLocale } from '@fintrack/shared';
import { uz } from './uz';
import { ru } from './ru';

export type BotTexts = typeof uz;

export const BOT_TEXTS: Record<AppLocale, BotTexts> = { uz, ru };

/** The bot's copy in the account's language (an unknown or "en" one reads as Uzbek). */
export function botText(locale: string | null | undefined): BotTexts {
  return BOT_TEXTS[toAppLocale(locale)];
}

/** The language the bot speaks to an account in. */
export function userLocale(user: { locale: string }): AppLocale {
  return toAppLocale(user.locale);
}

/**
 * A reply-keyboard button in every language. The keyboard on screen is the one sent last, so
 * after a language switch, or from a second device, the other language's button can still come.
 */
export function menuLabels(key: keyof BotTexts['menu']): string[] {
  return [uz.menu[key], ru.menu[key]];
}

/** Each language in its own words, the same in both dictionaries. */
export const LANGUAGE_NAMES: Record<AppLocale, string> = { uz: 'O‘zbekcha', ru: 'Русский' };
