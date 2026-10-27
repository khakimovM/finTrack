import type { PluralForms } from '@fintrack/shared';

/** Uzbek counts with one form ("3 ta yozuv"). */
export function counted(text: string): PluralForms {
  return { one: text, other: text };
}

/** Russian: 1 запись, 3 записи, 5 записей; a fraction takes the "few" form (1,5 записи). */
export function ruForms(one: string, few: string, many: string): PluralForms {
  return { one, few, many, other: few };
}
