import { counted } from '../counted';

/** The sign-in page and the Telegram code flow; the admin login shows the same flow in Uzbek. */
export const login = {
  title: 'FinTrack’ga kirish',
  description: 'Parol shart emas: kirish kodi Telegram’dagi botimizga keladi. Birinchi marta kirsangiz, hisob avtomatik yaratiladi.',
  warning: 'Kodni hech kimga bermang — FinTrack xodimlari uni hech qachon so‘ramaydi.',
  start: 'Telegram orqali kirish',
  connecting: 'Ulanmoqda…',
  retryLater: 'Birozdan so‘ng qayta urinib ko‘ring.',
  /** {bot} is the bot's @username and {start} the button's name, both drawn in bold. */
  stepOpen: 'Telegram’da {bot} ochiladi.',
  stepStart: '{start} tugmasini bosing (yangi bo‘lsangiz — raqamni ulashing).',
  startButton: 'Start',
  stepCode: 'Bot yuborgan 6 xonali kodni shu yerga kiriting.',
  openTelegram: 'Telegram’ni ochish',
  awaitingContact: 'Raqamingizni ulashishingiz kutilmoqda…',
  awaitingTelegram: 'Telegram’dan javob kutilmoqda…',
  codeSent: 'Kod Telegram’ga yuborildi',
  codeExpired: 'Kod muddati tugadi',
  codeLabel: 'Tasdiqlash kodi',
  codeInput: '6 xonali kod',
  wrongCode: counted('Kod noto‘g‘ri. Yana {count} ta urinish qoldi'),
  confirm: 'Tasdiqlash',
  verifying: 'Tekshirilmoqda…',
  validFor: 'Kod {time} amal qiladi',
  resend: 'Kodni qayta yuborish',
  resendIn: 'Qayta yuborish · {time}',
  cancelled: 'So‘rov Telegram’da rad etildi.',
  expired: 'So‘rov muddati tugadi. Qaytadan boshlang.',
  restart: 'Qaytadan boshlash',
};
