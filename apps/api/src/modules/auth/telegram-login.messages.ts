/** Uzbek copy for the sign-in flow in the bot. HTML parse mode: escape user-provided text. */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const LOGIN_TEXT = {
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
  welcomeBack: (name: string) =>
    `Xush kelibsiz, <b>${escapeHtml(name)}</b>! 👋`,
  welcomeNew:
    'Assalomu alaykum! FinTrack — shaxsiy moliyangiz uchun yordamchi.\n\nBoshlash uchun raqamingizni ulashing 👇',
  code: (code: string, device: string, ip: string | null) =>
    `🔐 <b>FinTrack</b> kirish kodi:\n\n<code>${code}</code>\n\n` +
    `Kod 3 daqiqa amal qiladi. <b>Uni hech kimga bermang</b> — FinTrack xodimlari ham so‘ramaydi.\n\n` +
    `So‘rov: ${escapeHtml(device)}${ip ? `, IP ${escapeHtml(ip)}` : ''}`,
  newLogin: (device: string, ip: string | null, time: string) =>
    `🔔 Hisobingizga yangi kirish: ${escapeHtml(device)}${ip ? `, IP ${escapeHtml(ip)}` : ''}, ${time}.\n\n` +
    'Bu siz bo‘lmasangiz, Sozlamalar → Sessiyalar bo‘limidan uni darhol yakunlang.',

  // Admin panel. A different heading and warning, so it is never mistaken for the ordinary code.
  adminCode: (code: string, device: string, ip: string | null) =>
    `🛡 <b>FinTrack admin panel</b> kirish kodi:\n\n<code>${code}</code>\n\n` +
    `Bu oddiy kirish kodi emas: u <b>admin huquqi</b> beradi. Kod 3 daqiqa amal qiladi, uni hech kimga bermang.\n\n` +
    `So‘rov: ${escapeHtml(device)}${ip ? `, IP ${escapeHtml(ip)}` : ''}`,
  adminNoAccount: 'Admin panelga kirish uchun avval botda ro‘yxatdan o‘ting: /start',
  adminLogin: (device: string, ip: string | null, time: string) =>
    `🛡 Admin panelga kirildi: ${escapeHtml(device)}${ip ? `, IP ${escapeHtml(ip)}` : ''}, ${time}.\n\n` +
    'Bu siz bo‘lmasangiz, ADMIN_TELEGRAM_IDS va server kirishlarini darhol tekshiring.',
  yourId: (id: number) => `🆔 Telegram ID'ingiz: <code>${id}</code>`,
};

/** Date and time of a sign-in notice, in the account's own time zone. */
export function noticeTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('uz-UZ', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(at);
}

/** "Chrome, Windows" from a User-Agent, good enough for a security notice. */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'noma’lum qurilma';
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'Brauzer';
  const os =
    /Windows/.test(userAgent) ? 'Windows'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : '';
  return os ? `${browser}, ${os}` : browser;
}
