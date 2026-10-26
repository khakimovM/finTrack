import { useCallback } from 'react';
import type { AppLocale } from '@fintrack/shared';
import { useLocaleStore } from '../../stores/localeStore';
import { ru } from './ru';
import { uz, type Dict } from './uz';

/**
 * Russian is offered once every page is written in it; until then only the dev server shows the
 * switch, and the account's language is not applied.
 */
export const RUSSIAN_READY = false;
export const LANGUAGE_SWITCH_VISIBLE = RUSSIAN_READY || import.meta.env.DEV;

/** Each language under its own name. */
export const LANGUAGE_NAMES: Record<AppLocale, string> = { uz: 'O‘zbekcha', ru: 'Русский' };

const DICTS: Record<AppLocale, Dict> = { uz, ru };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TextKey = Leaves<Dict>;
export type TextParams = Record<string, string | number>;

// The admin panel stays Uzbek whatever the user's language.
function onAdminPage(): boolean {
  return typeof window !== 'undefined' && /^\/admin(\/|$)/.test(window.location.pathname);
}

/** The language to write in right now, for code outside React (formatters, toasts). */
export function currentLocale(): AppLocale {
  return onAdminPage() ? 'uz' : useLocaleStore.getState().locale;
}

export function useLocale(): AppLocale {
  const locale = useLocaleStore((s) => s.locale);
  return onAdminPage() ? 'uz' : locale;
}

function lookup(dict: Dict, key: TextKey): string {
  let node: unknown = dict;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : key;
}

/** "{name}" in the text takes params.name. */
export function translate(locale: AppLocale, key: TextKey, params?: TextParams): string {
  const text = lookup(DICTS[locale], key);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function t(key: TextKey, params?: TextParams): string {
  return translate(currentLocale(), key, params);
}

/** `t` bound to the current language; the component re-renders when it changes. */
export function useT(): (key: TextKey, params?: TextParams) => string {
  const locale = useLocale();
  return useCallback((key: TextKey, params?: TextParams) => translate(locale, key, params), [locale]);
}
