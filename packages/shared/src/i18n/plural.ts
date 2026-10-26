import { AppLocale } from './locale';

/** Russian needs one / few / many ("1 запись", "3 записи", "5 записей"); Uzbek uses one form. */
export interface PluralForms {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

const RULES: Record<AppLocale, Intl.PluralRules> = {
  uz: new Intl.PluralRules('uz'),
  ru: new Intl.PluralRules('ru'),
};

export function plural(locale: AppLocale, count: number, forms: PluralForms): string {
  const category = RULES[locale].select(count) as keyof PluralForms;
  return forms[category] ?? forms.other;
}
