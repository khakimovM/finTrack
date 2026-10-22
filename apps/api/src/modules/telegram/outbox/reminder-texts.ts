import type { InlineKeyboardMarkup } from 'grammy/types';
import { parseIsoDate } from '@fintrack/shared';
import { escapeHtml } from '../../auth/telegram-login.messages';

export type ReminderKind = 'morning' | 'evening';

/**
 * One text per weekday, Monday first, so the same words do not come every day. Morning texts
 * invite to keep the day's record; evening ones go only to people who did not open FinTrack all
 * day, so they encourage, never scold. `{name}` is the first name.
 */
const TEXTS: Record<ReminderKind, readonly string[]> = {
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
};

/** Monday 0 … Sunday 6, for a `YYYY-MM-DD` day. */
function weekday(day: string): number {
  return (parseIsoDate(day).getUTCDay() + 6) % 7;
}

/** The first word of the name, so "Aziz Khakimov" reads "Aziz". */
function firstName(name: string): string {
  return escapeHtml(name.trim().split(/\s+/)[0] || 'do‘st');
}

export function reminderText(kind: ReminderKind, day: string, name: string): string {
  return TEXTS[kind][weekday(day)].replace('{name}', firstName(name));
}

/** Record straight from the reminder, or switch the reminders off without hunting for settings. */
export function reminderKeyboard(withOff = true): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '➖ Xarajat yozish', callback_data: 'rem:expense' },
        { text: '➕ Kirim yozish', callback_data: 'rem:income' },
      ],
      ...(withOff ? [[{ text: '🔕 Eslatmalarni o‘chirish', callback_data: 'rem:off' }]] : []),
    ],
  };
}
