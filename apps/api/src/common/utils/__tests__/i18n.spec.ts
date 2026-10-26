import {
  ERROR_TEXT,
  errorText,
  localeFromAcceptLanguage,
  MONTHS_IN_DATE,
  MONTHS_SHORT_STANDALONE,
  MONTHS_STANDALONE,
  plural,
  toAppLocale,
  WEEKDAYS,
} from '@fintrack/shared';

describe('shared i18n', () => {
  it('reads a stored or reported language as one the app has', () => {
    expect(toAppLocale('ru')).toBe('ru');
    expect(toAppLocale('RU-ru')).toBe('ru');
    expect(toAppLocale('en')).toBe('uz');
    expect(toAppLocale(null)).toBe('uz');
  });

  it('takes the first language of Accept-Language the app has', () => {
    expect(localeFromAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru');
    expect(localeFromAcceptLanguage('en-US,uz;q=0.5,ru;q=0.4')).toBe('uz');
    expect(localeFromAcceptLanguage('en-US')).toBe('uz');
    expect(localeFromAcceptLanguage(undefined)).toBe('uz');
  });

  it('counts in Russian with one, few and many', () => {
    const forms = { one: 'запись', few: 'записи', many: 'записей', other: 'записи' };
    expect([1, 3, 5, 11, 21, 22, 25].map((n) => `${n} ${plural('ru', n, forms)}`)).toEqual([
      '1 запись',
      '3 записи',
      '5 записей',
      '11 записей',
      '21 запись',
      '22 записи',
      '25 записей',
    ]);
    expect(plural('uz', 5, { one: 'yozuv', other: 'yozuv' })).toBe('yozuv');
  });

  it('writes months as a date and as a label on their own', () => {
    expect(MONTHS_IN_DATE.ru[4]).toBe('мая');
    expect(MONTHS_STANDALONE.ru[4]).toBe('май');
    expect(MONTHS_SHORT_STANDALONE.ru[4]).toBe('май');
    expect(MONTHS_IN_DATE.uz[9]).toBe('oktabr');
    expect(WEEKDAYS.ru[0]).toBe('понедельник');
  });

  it('has a Russian text for every error code, and nothing for an unknown one', () => {
    expect(Object.keys(ERROR_TEXT.ru).sort()).toEqual(Object.keys(ERROR_TEXT.uz).sort());
    expect(Object.values(ERROR_TEXT.ru).every((text) => /[а-яё]/i.test(text))).toBe(true);
    expect(errorText('ru', 'NOT_FOUND')).toBe('Не найдено');
    expect(errorText('uz', 'toString')).toBeUndefined();
    expect(errorText('ru', undefined)).toBeUndefined();
  });
});
