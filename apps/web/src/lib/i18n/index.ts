import { useCallback } from 'react';
import { plural, type AppLocale, type PluralForms } from '@fintrack/shared';
import { useLocaleStore } from '../../stores/localeStore';
import { ru } from './ru';
import { uz, type Dict } from './uz';

/** Each language under its own name. */
export const LANGUAGE_NAMES: Record<AppLocale, string> = { uz: 'O‘zbekcha', ru: 'Русский' };

const DICTS: Record<AppLocale, Dict> = { uz, ru };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends PluralForms
      ? never
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

type Counted<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : T[K] extends PluralForms
      ? `${P}${K}`
      : Counted<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TextKey = Leaves<Dict>;
/** A text that changes with a number ("1 запись", "5 записей"); it gets {count}. */
export type CountKey = Counted<Dict>;
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

function lookup(dict: Dict, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return node;
}

function fill(text: string, params?: TextParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** "{name}" in the text takes params.name. */
export function translate(locale: AppLocale, key: TextKey, params?: TextParams): string {
  const text = lookup(DICTS[locale], key);
  return typeof text === 'string' ? fill(text, params) : key;
}

export function translateCount(locale: AppLocale, key: CountKey, count: number, params?: TextParams): string {
  const forms = lookup(DICTS[locale], key) as PluralForms | undefined;
  if (!forms) return key;
  return fill(plural(locale, count, forms), { count, ...params });
}

/**
 * The router remounts when the language changes, so pages can call these while rendering;
 * components outside it use `useT()`.
 */
export function t(key: TextKey, params?: TextParams): string {
  return translate(currentLocale(), key, params);
}

export function tn(key: CountKey, count: number, params?: TextParams): string {
  return translateCount(currentLocale(), key, count, params);
}

/** `t` bound to the current language; the component re-renders when it changes. */
export function useT(): (key: TextKey, params?: TextParams) => string {
  const locale = useLocale();
  return useCallback((key: TextKey, params?: TextParams) => translate(locale, key, params), [locale]);
}
