import { AppLocale, CURRENCY_WORD, formatMoney, plural } from '@fintrack/shared';
import { AUTO_NOTE } from '../../common/i18n/auto-notes';

/**
 * What a notification says, in its owner's language. It is stored once, as written: the
 * notification list and the Telegram message both show the stored text.
 */
export interface NotificationText {
  title: string;
  body: string;
}

export interface DebtNotice {
  direction: 'I_LENT' | 'I_BORROWED';
  personName: string;
  remaining: bigint;
  /** YYYY-MM-DD */
  due: string;
}

const sum = (locale: AppLocale, tiyin: bigint) => formatMoney(tiyin, { currency: CURRENCY_WORD[locale] });

const uz = {
  budget: (exceeded: boolean, category: string, percent: number): NotificationText =>
    exceeded
      ? { title: 'Byudjet chegarasi oshib ketdi', body: `"${category}" byudjeti ${percent}% ga yetdi va limitdan oshdi.` }
      : { title: 'Byudjet chegarasi ogohlantirishi', body: `"${category}" byudjetining ${percent}% qismi sarflandi.` },
  debtDueSoon: (d: DebtNotice, daysLeft: number): NotificationText => {
    const when = daysLeft === 0 ? 'bugun' : `${daysLeft} kundan keyin`;
    return {
      title: 'Qarz muddati yaqinlashmoqda',
      body:
        d.direction === 'I_LENT'
          ? `${d.personName} sizga ${sum('uz', d.remaining)} qaytarishi kerak — muddat ${when} (${d.due}).`
          : `${d.personName}ga ${sum('uz', d.remaining)} qaytarishingiz kerak — muddat ${when} (${d.due}).`,
    };
  },
  debtOverdue: (d: DebtNotice, daysOverdue: number): NotificationText => ({
    title: 'Qarz muddati o‘tdi',
    body:
      d.direction === 'I_LENT'
        ? `${d.personName}ning ${sum('uz', d.remaining)} qarzi muddati ${daysOverdue} kun o‘tdi (${d.due}).`
        : `${d.personName}ga ${sum('uz', d.remaining)} qarzingiz muddati ${daysOverdue} kun o‘tdi (${d.due}).`,
  }),
  negativeBalance: (account: string, balance: bigint): NotificationText => ({
    title: 'Hisob balansi manfiy',
    body: `"${account}" hisobida balans ${sum('uz', balance)} bo‘ldi.`,
  }),
  /** A recurring rule without a note of its own. */
  recurringLabel: AUTO_NOTE.uz.recurring,
  recurringCreated: (label: string, amount: bigint, count: number, last: string): NotificationText => ({
    title: 'Takroriy to‘lov yozildi',
    body:
      count === 1
        ? `"${label}": ${sum('uz', amount)} (${last}) yozildi.`
        : `"${label}": ${count} ta to‘lov yozildi, oxirgisi ${last}.`,
  }),
  recurringSkipped: (label: string, amount: bigint, date: string): NotificationText => ({
    title: 'Takroriy to‘lov bajarilmadi',
    body: `"${label}" (${sum('uz', amount)}, ${date}) hisobda mablag‘ yetarli bo‘lmagani uchun yozilmadi.`,
  }),
  recurringStopped: (label: string): NotificationText => ({
    title: 'Takroriy to‘lov to‘xtatildi',
    body: `"${label}" hisobi arxivlangani yoki o‘chirilgani uchun to‘xtatildi.`,
  }),
};

export type NotificationTexts = typeof uz;

const DAYS = { one: 'день', few: 'дня', many: 'дней', other: 'дня' };

// The person's name stays in the nominative and the verbs in forms that fit any gender.
const ru: NotificationTexts = {
  budget: (exceeded, category, percent) =>
    exceeded
      ? { title: 'Бюджет превышен', body: `Бюджет «${category}» израсходован на ${percent}% — лимит превышен.` }
      : { title: 'Бюджет почти исчерпан', body: `Бюджет «${category}» израсходован на ${percent}%.` },
  debtDueSoon: (d, daysLeft) => {
    const when = daysLeft === 0 ? 'сегодня' : `через ${daysLeft} ${plural('ru', daysLeft, DAYS)}`;
    return {
      title: 'Скоро срок возврата долга',
      body:
        d.direction === 'I_LENT'
          ? `${d.personName} возвращает вам ${sum('ru', d.remaining)} — срок ${when} (${d.due}).`
          : `Вам нужно вернуть ${sum('ru', d.remaining)} (${d.personName}) — срок ${when} (${d.due}).`,
    };
  },
  debtOverdue: (d, daysOverdue) => ({
    title: 'Срок долга истёк',
    body:
      d.direction === 'I_LENT'
        ? `${d.personName}: возврат ${sum('ru', d.remaining)} просрочен на ${daysOverdue} дн. (срок был ${d.due}).`
        : `Ваш долг ${sum('ru', d.remaining)} (${d.personName}) просрочен на ${daysOverdue} дн. (срок был ${d.due}).`,
  }),
  negativeBalance: (account, balance) => ({
    title: 'Отрицательный баланс счёта',
    body: `Баланс счёта «${account}» стал ${sum('ru', balance)}.`,
  }),
  recurringLabel: AUTO_NOTE.ru.recurring,
  recurringCreated: (label, amount, count, last) => ({
    title: 'Регулярный платёж записан',
    body:
      count === 1
        ? `«${label}»: записано ${sum('ru', amount)} (${last}).`
        : `«${label}»: записано платежей — ${count}, последний ${last}.`,
  }),
  recurringSkipped: (label, amount, date) => ({
    title: 'Регулярный платёж не выполнен',
    body: `«${label}» (${sum('ru', amount)}, ${date}) не записан: на счёте недостаточно средств.`,
  }),
  recurringStopped: (label) => ({
    title: 'Регулярный платёж остановлен',
    body: `«${label}» остановлен: счёт архивирован или удалён.`,
  }),
};

export const NOTIFICATION_TEXTS: Record<AppLocale, NotificationTexts> = { uz, ru };
