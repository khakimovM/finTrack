import { AppLocale } from './locale';

/**
 * What a failed request tells the user, by error code (docs/04). The web shows these instead of
 * the API's message; the API answers Russian requests with them. Admin-only codes are left out:
 * the admin panel stays Uzbek.
 */
const uz = {
  VALIDATION_ERROR: "Kiritilgan ma'lumotlar noto'g'ri",
  UNAUTHENTICATED: 'Tizimga kirish talab qilinadi',
  FORBIDDEN: 'Ruxsat berilmagan',
  OTP_INVALID: 'Kod noto‘g‘ri',
  OTP_EXPIRED: 'Kod muddati tugagan yoki u ishlatilgan. Qaytadan kiring',
  OTP_ATTEMPTS_EXCEEDED: 'Urinishlar soni tugadi. Qaytadan kiring',
  OTP_RESEND_LIMIT: 'Kod juda ko‘p marta so‘raldi. Qaytadan kiring',
  TELEGRAM_UNAVAILABLE: 'Telegram orqali kirish vaqtincha ishlamayapti',
  TELEGRAM_NOT_REGISTERED: 'Avval botda /start bosib, telefon raqamingizni ulashing',
  ACCOUNT_BANNED: 'Hisobingiz bloklangan. Sayt, ilova va bot orqali kirib bo‘lmaydi',
  TELEGRAM_INIT_DATA_INVALID: 'Telegram maʼlumotlari tasdiqlanmadi. Ilovani botdan qayta oching',
  TELEGRAM_INIT_DATA_EXPIRED: 'Ilova sessiyasi tugadi. Ilovani botdan qayta oching',
  TOKEN_REUSE_DETECTED: 'Xavfsizlik sababli sessiyangiz yakunlandi, qayta kiring',
  NOT_FOUND: 'Resurs topilmadi',
  CATEGORY_EXISTS: 'Bunday nomli kategoriya allaqachon mavjud',
  TAG_EXISTS: 'Bunday teg allaqachon mavjud',
  ACCOUNT_EXISTS: 'Bunday nomli hisob allaqachon mavjud',
  DEBT_ALREADY_PAID: 'Ushbu qarz allaqachon to‘liq to‘langan',
  INSUFFICIENT_BALANCE: 'Hisobingizda mablag‘ yetarli emas',
  DEBT_OVERPAYMENT: 'To‘lov summasi qoldiq qarzdan oshib ketdi',
  SAME_ACCOUNT_TRANSFER: 'Bitta hisobning o‘ziga o‘tkazma qilib bo‘lmaydi',
  INVALID_CATEGORY_TYPE: 'Kategoriya turi tranzaksiya turiga mos kelmadi',
  CIRCULAR_CATEGORY: 'Kategoriya o‘ziga ota bo‘la olmaydi',
  FUTURE_DATE: 'Tranzaksiya sanasi kelajakda bo‘lishi mumkin emas',
  SYSTEM_CATEGORY: 'Tizim kategoriyasini o‘chirib bo‘lmaydi',
  RATE_LIMITED: 'So‘rovlar chegarasidan oshib ketdi, biroz kuting',
  RECURRING_INACTIVE: 'To‘xtatilgan qoidani bajarib bo‘lmaydi. Avval uni davom ettiring',
  RECURRING_ALREADY_RAN: 'Bugungi to‘lov allaqachon yozilgan va o‘chirilgan — qayta yozilmaydi',
  INVALID_REFERENCE: 'Tanlangan hisob yoki kategoriya topilmadi. Sahifani yangilang',
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
  PAYLOAD_TOO_LARGE: 'So‘rov hajmi juda katta',
  UNPROCESSABLE_ENTITY: 'So‘rovni bajarib bo‘lmadi',
  SERVICE_UNAVAILABLE: 'Xizmat vaqtincha ishlamayapti. Birozdan so‘ng urinib ko‘ring',
  INTERNAL_ERROR: 'Serverda ichki xatolik yuz berdi',
};

export type ErrorTextCode = keyof typeof uz;

const ru: Record<ErrorTextCode, string> = {
  VALIDATION_ERROR: 'Введены неверные данные',
  UNAUTHENTICATED: 'Требуется вход в систему',
  FORBIDDEN: 'Доступ запрещён',
  OTP_INVALID: 'Неверный код',
  OTP_EXPIRED: 'Срок действия кода истёк или он уже использован. Войдите заново',
  OTP_ATTEMPTS_EXCEEDED: 'Попытки закончились. Войдите заново',
  OTP_RESEND_LIMIT: 'Код запрашивали слишком много раз. Войдите заново',
  TELEGRAM_UNAVAILABLE: 'Вход через Telegram временно не работает',
  TELEGRAM_NOT_REGISTERED: 'Сначала нажмите /start в боте и поделитесь номером телефона',
  ACCOUNT_BANNED: 'Ваш аккаунт заблокирован. Войти через сайт, приложение и бот нельзя',
  TELEGRAM_INIT_DATA_INVALID: 'Данные Telegram не подтверждены. Откройте приложение из бота заново',
  TELEGRAM_INIT_DATA_EXPIRED: 'Сессия приложения истекла. Откройте приложение из бота заново',
  TOKEN_REUSE_DETECTED: 'В целях безопасности сессия завершена. Войдите заново',
  NOT_FOUND: 'Не найдено',
  CATEGORY_EXISTS: 'Категория с таким названием уже есть',
  TAG_EXISTS: 'Такой тег уже есть',
  ACCOUNT_EXISTS: 'Счёт с таким названием уже есть',
  DEBT_ALREADY_PAID: 'Этот долг уже полностью погашен',
  INSUFFICIENT_BALANCE: 'На счёте недостаточно средств',
  DEBT_OVERPAYMENT: 'Сумма платежа больше остатка долга',
  SAME_ACCOUNT_TRANSFER: 'Нельзя сделать перевод на тот же счёт',
  INVALID_CATEGORY_TYPE: 'Тип категории не подходит к типу операции',
  CIRCULAR_CATEGORY: 'Категория не может быть родительской для самой себя',
  FUTURE_DATE: 'Дата операции не может быть в будущем',
  SYSTEM_CATEGORY: 'Системную категорию нельзя удалить',
  RATE_LIMITED: 'Слишком много запросов, подождите немного',
  RECURRING_INACTIVE: 'Приостановленное правило нельзя выполнить. Сначала возобновите его',
  RECURRING_ALREADY_RAN: 'Сегодняшний платёж уже был записан и удалён — повторно он не запишется',
  INVALID_REFERENCE: 'Выбранный счёт или категория не найдены. Обновите страницу',
  MANAGED_TRANSACTION: 'Эта запись относится к переводу или долгу — измените её в том разделе',
  ACCOUNT_HAS_HISTORY: 'На счёте есть операции. Вместо удаления отправьте его в архив',
  ACCOUNT_ARCHIVED: 'В архивный счёт нельзя добавлять записи',
  LAST_ACCOUNT: 'Должен остаться хотя бы один активный счёт',
  BUDGET_EXISTS: 'Бюджет на эту категорию в этом месяце уже есть',
  INVALID_CATEGORY_DEPTH: 'Категории могут быть только двух уровней',
  INVALID_TRANSACTION_TYPE: 'Запись такого типа здесь создать нельзя',
  EXPORT_TOO_LARGE: 'Слишком большой экспорт. Сократите период',
  CONCURRENT_UPDATE: 'Данные изменились одновременно. Попробуйте ещё раз',
  CONFLICT: 'Такая запись уже есть',
  CSRF_REJECTED: 'Запрос отклонён. Обновите страницу',
  PAYLOAD_TOO_LARGE: 'Слишком большой запрос',
  UNPROCESSABLE_ENTITY: 'Не удалось выполнить запрос',
  SERVICE_UNAVAILABLE: 'Сервис временно не работает. Попробуйте чуть позже',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера',
};

export const ERROR_TEXT: Record<AppLocale, Record<ErrorTextCode, string>> = { uz, ru };

/** When the code is unknown or missing. */
export const UNKNOWN_ERROR_TEXT: Record<AppLocale, string> = {
  uz: 'Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring',
  ru: 'Произошла непредвиденная ошибка. Попробуйте ещё раз',
};

function isErrorTextCode(code: string): code is ErrorTextCode {
  return Object.prototype.hasOwnProperty.call(uz, code);
}

export function errorText(locale: AppLocale, code: string | null | undefined): string | undefined {
  return code && isErrorTextCode(code) ? ERROR_TEXT[locale][code] : undefined;
}
