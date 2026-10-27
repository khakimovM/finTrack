import { AppLocale, toAppLocale } from '@fintrack/shared';

/** The sign-in flow in the bot, in each language. HTML parse mode: escape user-provided text. */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const requestedFrom = (device: string, ip: string | null) => `${escapeHtml(device)}${ip ? `, IP ${escapeHtml(ip)}` : ''}`;

const uz = {
  askContact:
    'Assalomu alaykum! 👋\n\nFinTrack hisobingizni yaratish uchun pastdagi <b>“📱 Raqamni ulashish”</b> tugmasini bosing. ' +
    'Raqamingiz faqat hisobingizni tasdiqlash uchun ishlatiladi.',
  shareContactButton: '📱 Raqamni ulashish',
  contactNotYours: 'Iltimos, boshqa odamning emas, <b>o‘zingizning</b> raqamingizni tugma orqali ulashing.',
  expired: 'Bu kirish havolasining muddati tugagan. Saytda “Telegram orqali kirish” tugmasini qayta bosing.',
  alreadyUsed: 'Bu havola allaqachon ishlatilgan. Kerak bo‘lsa, saytdan qaytadan kiring.',
  tooManyCodes: 'Juda ko‘p kod so‘raldi. 15 daqiqadan so‘ng qayta urinib ko‘ring.',
  cancelled: '❌ Kirish so‘rovi rad etildi. Agar bu siz bo‘lmasangiz, hech narsa qilishingiz shart emas.',
  cancelButton: '❌ Bu men emasman',
  registered: '✅ Hisobingiz yaratildi! Endi saytga qaytib, quyidagi kodni kiriting.',
  registeredPlain: '✅ Hisobingiz yaratildi! Endi xarajat va kirimlaringizni shu yerga yozishingiz mumkin.',
  linked: '✅ Telegram hisobingiz FinTrack profilingizga ulandi.',
  linkConflict: 'Bu Telegram hisobi boshqa FinTrack profiliga ulangan.',
  welcomeBack: (name: string) => `Xush kelibsiz, <b>${escapeHtml(name)}</b>! 👋`,
  welcomeNew:
    'Assalomu alaykum! FinTrack — shaxsiy moliyangiz uchun yordamchi.\n\nBoshlash uchun raqamingizni ulashing 👇',
  code: (code: string, device: string, ip: string | null) =>
    `🔐 <b>FinTrack</b> kirish kodi:\n\n<code>${code}</code>\n\n` +
    `Kod 3 daqiqa amal qiladi. <b>Uni hech kimga bermang</b> — FinTrack xodimlari ham so‘ramaydi.\n\n` +
    `So‘rov: ${requestedFrom(device, ip)}`,
  newLogin: (device: string, ip: string | null, time: string) =>
    `🔔 Hisobingizga yangi kirish: ${requestedFrom(device, ip)}, ${time}.\n\n` +
    'Bu siz bo‘lmasangiz, Sozlamalar → Sessiyalar bo‘limidan uni darhol yakunlang.',
  // A ban (admin panel, J4): the reason is the owner's own words, shown to the user once.
  banned: '🚫 FinTrack hisobingiz bloklangan. Sayt, ilova va bot orqali foydalanib bo‘lmaydi.',
  bannedNotice: (reason: string) => `🚫 FinTrack hisobingiz bloklandi: barcha sessiyalar yakunlandi.\n\nSabab: ${escapeHtml(reason)}`,
  unbanned: '✅ FinTrack hisobingiz qayta ochildi. Saytga, ilovaga va botga yana kirishingiz mumkin.',
  yourId: (id: number) => `🆔 Telegram ID'ingiz: <code>${id}</code>`,
  accountDeleted: 'Hisobingiz va barcha maʼlumotlaringiz o‘chirildi. Xayr! 👋',
  unknownDevice: 'noma’lum qurilma',
  browser: 'Brauzer',
};

export type LoginTexts = typeof uz;

const ru: LoginTexts = {
  askContact:
    'Здравствуйте! 👋\n\nЧтобы создать аккаунт FinTrack, нажмите кнопку <b>«📱 Поделиться номером»</b> ниже. ' +
    'Номер нужен только для подтверждения аккаунта.',
  shareContactButton: '📱 Поделиться номером',
  contactNotYours: 'Пожалуйста, поделитесь через кнопку <b>своим</b> номером, а не чужим.',
  expired: 'Срок действия этой ссылки для входа истёк. Нажмите «Войти через Telegram» на сайте ещё раз.',
  alreadyUsed: 'Эта ссылка уже использована. Если нужно, войдите на сайте заново.',
  tooManyCodes: 'Запрошено слишком много кодов. Попробуйте снова через 15 минут.',
  cancelled: '❌ Запрос на вход отклонён. Если это были не вы, ничего делать не нужно.',
  cancelButton: '❌ Это не я',
  registered: '✅ Аккаунт создан! Теперь вернитесь на сайт и введите код ниже.',
  registeredPlain: '✅ Аккаунт создан! Теперь можно записывать расходы и доходы прямо сюда.',
  linked: '✅ Ваш аккаунт Telegram привязан к профилю FinTrack.',
  linkConflict: 'Этот аккаунт Telegram уже привязан к другому профилю FinTrack.',
  welcomeBack: (name: string) => `С возвращением, <b>${escapeHtml(name)}</b>! 👋`,
  welcomeNew: 'Здравствуйте! FinTrack — помощник для ваших личных финансов.\n\nЧтобы начать, поделитесь номером 👇',
  code: (code: string, device: string, ip: string | null) =>
    `🔐 Код для входа в <b>FinTrack</b>:\n\n<code>${code}</code>\n\n` +
    `Код действует 3 минуты. <b>Никому его не сообщайте</b> — сотрудники FinTrack тоже не спрашивают.\n\n` +
    `Запрос: ${requestedFrom(device, ip)}`,
  newLogin: (device: string, ip: string | null, time: string) =>
    `🔔 Новый вход в ваш аккаунт: ${requestedFrom(device, ip)}, ${time}.\n\n` +
    'Если это были не вы, сразу завершите этот сеанс в разделе Настройки → Сеансы.',
  banned: '🚫 Ваш аккаунт FinTrack заблокирован. Пользоваться сайтом, приложением и ботом нельзя.',
  bannedNotice: (reason: string) => `🚫 Ваш аккаунт FinTrack заблокирован: все сеансы завершены.\n\nПричина: ${escapeHtml(reason)}`,
  unbanned: '✅ Ваш аккаунт FinTrack снова открыт. Сайт, приложение и бот снова доступны.',
  yourId: (id: number) => `🆔 Ваш Telegram ID: <code>${id}</code>`,
  accountDeleted: 'Ваш аккаунт и все данные удалены. До свидания! 👋',
  unknownDevice: 'неизвестное устройство',
  browser: 'Браузер',
};

export const LOGIN_TEXTS: Record<AppLocale, LoginTexts> = { uz, ru };

/** The sign-in copy in an account's language, or in a newcomer's Telegram language. */
export function loginText(locale: string | null | undefined): LoginTexts {
  return LOGIN_TEXTS[toAppLocale(locale)];
}

/** Admin panel sign-in, Uzbek like the panel. A different heading, so it is never mistaken for the ordinary code. */
export const ADMIN_LOGIN_TEXT = {
  code: (code: string, device: string, ip: string | null) =>
    `🛡 <b>FinTrack admin panel</b> kirish kodi:\n\n<code>${code}</code>\n\n` +
    `Bu oddiy kirish kodi emas: u <b>admin huquqi</b> beradi. Kod 3 daqiqa amal qiladi, uni hech kimga bermang.\n\n` +
    `So‘rov: ${requestedFrom(device, ip)}`,
  noAccount: 'Admin panelga kirish uchun avval botda ro‘yxatdan o‘ting: /start',
  login: (device: string, ip: string | null, time: string) =>
    `🛡 Admin panelga kirildi: ${requestedFrom(device, ip)}, ${time}.\n\n` +
    'Bu siz bo‘lmasangiz, ADMIN_TELEGRAM_IDS va server kirishlarini darhol tekshiring.',
};

/** Date and time of a sign-in notice, in the account's own time zone and language. */
export function noticeTime(at: Date, timeZone: string, locale: AppLocale = 'uz'): string {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'uz-UZ', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(at);
}

/** "Chrome, Windows" from a User-Agent, good enough for a security notice. */
export function describeDevice(userAgent: string | null | undefined, locale: AppLocale = 'uz'): string {
  if (!userAgent) return LOGIN_TEXTS[locale].unknownDevice;
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Safari\//.test(userAgent) ? 'Safari'
    : LOGIN_TEXTS[locale].browser;
  const os =
    /Windows/.test(userAgent) ? 'Windows'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : '';
  return os ? `${browser}, ${os}` : browser;
}
