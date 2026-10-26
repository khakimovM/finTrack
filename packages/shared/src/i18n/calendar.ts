import { UZ_MONTHS } from '../date';
import { AppLocale } from './locale';

/** Months inside a date: "3-oktabr", "3 октября" (Russian takes the genitive there). */
export const MONTHS_IN_DATE: Record<AppLocale, readonly string[]> = {
  uz: UZ_MONTHS,
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
};

/** A month on its own: "oktabr", "октябрь" (callers capitalise a standalone label). */
export const MONTHS_STANDALONE: Record<AppLocale, readonly string[]> = {
  uz: UZ_MONTHS,
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
};

export const MONTHS_SHORT: Record<AppLocale, readonly string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};

/** Short months on their own, e.g. a chart axis: "may", "май" (not the "мая" of "3 мая"). */
export const MONTHS_SHORT_STANDALONE: Record<AppLocale, readonly string[]> = {
  uz: MONTHS_SHORT.uz,
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};

/** Monday first, as the calendars in the design. */
export const WEEKDAYS: Record<AppLocale, readonly string[]> = {
  uz: ['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'],
  ru: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
};

export const WEEKDAYS_SHORT: Record<AppLocale, readonly string[]> = {
  uz: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
};

export const CURRENCY_WORD: Record<AppLocale, string> = { uz: 'so‘m', ru: 'сум' };

/** Units of the short amount form: "1,5 mln", "250 тыс.". */
export const AMOUNT_UNITS: Record<AppLocale, { thousand: string; million: string; billion: string }> = {
  uz: { thousand: 'ming', million: 'mln', billion: 'mlrd' },
  ru: { thousand: 'тыс.', million: 'млн', billion: 'млрд' },
};
