import axios from 'axios';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Kiritilgan ma'lumotlar noto'g'ri",
  UNAUTHENTICATED: 'Tizimga kirish talab qilinadi',
  INVALID_CREDENTIALS: 'Email yoki parol noto‘g‘ri',
  EMAIL_TAKEN: 'Bu email allaqachon ro‘yxatdan o‘tgan',
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
