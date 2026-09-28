import axios from 'axios';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Kiritilgan ma'lumotlar noto'g'ri",
  UNAUTHENTICATED: 'Tizimga kirish talab qilinadi',
  OTP_INVALID: 'Kod noto‘g‘ri',
  OTP_EXPIRED: 'Kod muddati tugagan yoki u ishlatilgan. Qaytadan kiring',
  OTP_ATTEMPTS_EXCEEDED: 'Urinishlar soni tugadi. Qaytadan kiring',
  OTP_RESEND_LIMIT: 'Kod juda ko‘p marta so‘raldi. Qaytadan kiring',
  TELEGRAM_UNAVAILABLE: 'Telegram orqali kirish vaqtincha ishlamayapti',
  TELEGRAM_NOT_REGISTERED: 'Avval botda /start bosib, telefon raqamingizni ulashing',
  TELEGRAM_INIT_DATA_INVALID: 'Telegram maʼlumotlari tasdiqlanmadi. Ilovani botdan qayta oching',
  TELEGRAM_INIT_DATA_EXPIRED: 'Ilova sessiyasi tugadi. Ilovani botdan qayta oching',
  TOKEN_REUSE_DETECTED: 'Xavfsizlik sababli sessiyangiz yakunlandi, qayta kiring',
  NOT_FOUND: 'Resurs topilmadi',
  CATEGORY_EXISTS: 'Bunday nomli kategoriya allaqachon mavjud',
  ACCOUNT_EXISTS: 'Bunday nomli hisob allaqachon mavjud',
  DEBT_ALREADY_PAID: 'Ushbu qarz allaqachon to‘liq to‘langan',
  INSUFFICIENT_BALANCE: 'Hisobingizda mablag‘ yetarli emas',
  DEBT_OVERPAYMENT: 'To‘lov summasi qoldiq qarzdan oshib ketdi',
  SAME_ACCOUNT_TRANSFER: 'Bitta hisobning o‘ziga o‘tkazma qilib bo‘lmaydi',
  INVALID_CATEGORY_TYPE: 'Kategoriya turi tranzaksiya turiga mos kelmadi',
  FUTURE_DATE: 'Tranzaksiya sanasi kelajakda bo‘lishi mumkin emas',
  SYSTEM_CATEGORY: 'Tizim kategoriyasini o‘chirib bo‘lmaydi',
  RATE_LIMITED: 'So‘rovlar chegarasidan oshib ketdi, biroz kuting',
  MANAGED_TRANSACTION: 'Bu yozuv o‘tkazma yoki qarzga tegishli — uni o‘sha bo‘limdan o‘zgartiring',
  ACCOUNT_HAS_HISTORY: 'Hisobda tranzaksiyalar bor. O‘chirish o‘rniga arxivlang',
  ACCOUNT_ARCHIVED: 'Arxivlangan hisobga yozuv qo‘shib bo‘lmaydi',
  LAST_ACCOUNT: 'Kamida bitta faol hisob qolishi kerak',
  BUDGET_EXISTS: 'Bu oy uchun ushbu kategoriyada byudjet allaqachon bor',
  INVALID_CATEGORY_DEPTH: 'Kategoriyalar faqat ikki darajali bo‘lishi mumkin',
  INVALID_TRANSACTION_TYPE: 'Bu turdagi yozuvni bu yerda yaratib bo‘lmaydi',
  EXPORT_TOO_LARGE: 'Eksport juda katta. Sana oralig‘ini qisqartiring',
  CONCURRENT_UPDATE: 'Maʼlumot bir vaqtda o‘zgartirildi. Qayta urinib ko‘ring',
  CONFLICT: 'Bunday yozuv allaqachon mavjud',
  CSRF_REJECTED: 'So‘rov rad etildi. Sahifani yangilang',
  SERVICE_UNAVAILABLE: 'Xizmat vaqtincha ishlamayapti. Birozdan so‘ng urinib ko‘ring',
  INTERNAL_ERROR: 'Serverda ichki xatolik yuz berdi',
};

/**
 * Maps Axios or unknown errors into user-friendly Uzbek messages.
 */
export function apiErrorToMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.data) {
    const errorData = (error.response.data as { error?: ApiErrorPayload })?.error;
    if (errorData?.code && ERROR_MESSAGES[errorData.code]) {
      return ERROR_MESSAGES[errorData.code];
    }
    if (errorData?.message) {
      return errorData.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring';
}
