import type { InlineKeyboardMarkup } from 'grammy/types';
import { AppLocale, parseIsoDate } from '@fintrack/shared';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { BOT_TEXTS } from '../i18n';

export type ReminderKind = 'morning' | 'evening';

/**
 * One text per weekday, Monday first, so the same words do not come every day. Morning texts
 * invite to keep the day's record; evening ones go only to people who did not open FinTrack all
 * day, so they encourage, never scold. `{name}` is the first name.
 */
const TEXTS: Record<AppLocale, Record<ReminderKind, readonly string[]>> = {
  uz: {
    morning: [
      '☀️ Xayrli tong, {name}! Yangi hafta boshlandi. Bugungi har bir xarajatni yozib boring — hafta oxirida pulingiz qayerga ketganini aniq ko‘rasiz.',
      '🌅 Xayrli tong, {name}! Kofe, taksi, nonushta — kichik xarajatlar eng tez unutiladi. Bugun ularni ham yozing, 5 soniya yetadi: <code>15000 kofe</code>',
      '☕ Xayrli tong, {name}! Haftaning yarmi. Bugun nimaga qancha ketishini yozib borsangiz, kechqurun hisobot o‘zi tayyor bo‘ladi.',
      '🌤 Xayrli tong, {name}! Odat har kungi kichik qadamdan boshlanadi. Bugun ham kirim-chiqimingizni yozib, o‘sha qadamni qo‘ying.',
      '🌞 Xayrli tong, {name}! Juma — dam olish oldidan xarajatlar ko‘payadigan kun. Byudjetingizga bir nazar tashlab, bugungilarni yozib boring.',
      '😊 Xayrli tong, {name}! Dam olish kunida ham pul sarflanadi. Yozish oson — botga shunchaki yuboring: <code>50000 bozor</code>',
      '🌈 Xayrli tong, {name}! Haftaning oxirgi kuni. Bugungi xarajatlarni ham yozsangiz, kechqurun butun hafta hisoboti to‘liq bo‘ladi.',
    ],
    evening: [
      '🌙 {name}, bugun hali birorta yozuv qilmadingiz. Kunni yopishdan oldin bir daqiqa ajrating: bugun nimaga pul sarfladingiz? Masalan: <code>30000 tushlik</code>',
      '✨ {name}, kichik qadamlar katta natija beradi. Bugungi xarajatlarni hozir yozib qo‘ysangiz, ertaga ularni eslashga urinib o‘tirmaysiz.',
      '🌜 Kun tugayapti, {name}. Bugun pulingiz qayerga ketganini bilasizmi? Yozib qo‘ying — hafta oxiridagi hisobot aniqroq bo‘ladi.',
      '📒 {name}, pulni boshqarish uni ko‘rishdan boshlanadi. Bugungi kirim va chiqimni yozing — ertangi o‘zingiz rahmat aytadi.',
      '🎯 {name}, maqsadga har kungi odat bilan yetiladi. Bugungi xarajatlarni yozish bir daqiqa oladi: summa va nima uchunligi, masalan <code>20000 taksi</code>',
      '🌙 {name}, bugun FinTrack’ni ochmadingiz. Hech narsa sarflamagan bo‘lsangiz — ajoyib kun! Sarflagan bo‘lsangiz, uxlashdan oldin yozib qo‘ying.',
      '⭐️ {name}, yangi hafta oldidan bugungi xarajatlarni ham yozib qo‘ying — shunda hafta hisobotingiz to‘liq bo‘ladi va kelasi haftani aniqroq rejalaysiz.',
    ],
  },
  ru: {
    morning: [
      '☀️ Доброе утро, {name}! Началась новая неделя. Записывайте каждый расход за день — в конце недели вы точно увидите, куда ушли деньги.',
      '🌅 Доброе утро, {name}! Кофе, такси, завтрак — мелкие расходы забываются быстрее всего. Запишите сегодня и их, хватит 5 секунд: <code>15000 кофе</code>',
      '☕ Доброе утро, {name}! Середина недели. Записывайте, на что и сколько уходит за день, — вечером отчёт будет готов сам.',
      '🌤 Доброе утро, {name}! Привычка складывается из маленьких ежедневных шагов. Сделайте сегодняшний — запишите доходы и расходы.',
      '🌞 Доброе утро, {name}! Пятница — перед выходными расходов обычно больше. Загляните в бюджет и записывайте сегодняшние траты.',
      '😊 Доброе утро, {name}! В выходной деньги тоже тратятся. Записать просто — отправьте боту: <code>50000 базар</code>',
      '🌈 Доброе утро, {name}! Последний день недели. Запишите и сегодняшние расходы — вечером отчёт за всю неделю будет полным.',
    ],
    evening: [
      '🌙 {name}, сегодня вы ещё ничего не записали. Перед тем как закрыть день, уделите минуту: на что сегодня ушли деньги? Например: <code>30000 обед</code>',
      '✨ {name}, маленькие шаги дают большой результат. Запишите сегодняшние расходы сейчас — завтра не придётся их вспоминать.',
      '🌜 День подходит к концу, {name}. Знаете, куда сегодня ушли деньги? Запишите — отчёт в конце недели будет точнее.',
      '📒 {name}, управлять деньгами начинают с того, чтобы их видеть. Запишите сегодняшние доходы и расходы — завтра вы сами скажете себе спасибо.',
      '🎯 {name}, к цели ведёт ежедневная привычка. Записать расходы за день — одна минута: сумма и на что, например <code>20000 такси</code>',
      '🌙 {name}, сегодня вы не открывали FinTrack. Если ничего не потратили — отличный день! Если потратили — запишите перед сном.',
      '⭐️ {name}, перед новой неделей запишите и сегодняшние расходы — тогда отчёт за неделю будет полным, а следующую неделю вы спланируете точнее.',
    ],
  },
};

/** Monday 0 … Sunday 6, for a `YYYY-MM-DD` day. */
function weekday(day: string): number {
  return (parseIsoDate(day).getUTCDay() + 6) % 7;
}

/** The first word of the name, so "Aziz Khakimov" reads "Aziz". */
function firstName(name: string, locale: AppLocale): string {
  return escapeHtml(name.trim().split(/\s+/)[0] || BOT_TEXTS[locale].reminders.friend);
}

export function reminderText(kind: ReminderKind, day: string, name: string, locale: AppLocale): string {
  return TEXTS[locale][kind][weekday(day)].replace('{name}', firstName(name, locale));
}

/** Record straight from the reminder, or switch the reminders off without hunting for settings. */
export function reminderKeyboard(locale: AppLocale, withOff = true): InlineKeyboardMarkup {
  const t = BOT_TEXTS[locale].reminders;
  return {
    inline_keyboard: [
      [
        { text: t.expense, callback_data: 'rem:expense' },
        { text: t.income, callback_data: 'rem:income' },
      ],
      ...(withOff ? [[{ text: t.off, callback_data: 'rem:off' }]] : []),
    ],
  };
}
