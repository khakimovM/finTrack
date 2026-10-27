import { TransactionType } from '@prisma/client';
import { AppLocale } from '@fintrack/shared';

interface ExportTexts {
  types: Record<TransactionType, string>;
  /** Date, type, account, category, amount, tags, note: the column order of both files. */
  headers: [string, string, string, string, string, string, string];
  sheet: string;
}

/** The export in the language of the page that asked for it, as the web app words the same things. */
export const EXPORT_TEXTS: Record<AppLocale, ExportTexts> = {
  uz: {
    types: {
      INCOME: 'Kirim',
      EXPENSE: 'Chiqim',
      TRANSFER_IN: 'O‘tkazma (kirim)',
      TRANSFER_OUT: 'O‘tkazma (chiqim)',
      LOAN_GIVEN: 'Qarz berildi',
      LOAN_TAKEN: 'Qarz olindi',
      LOAN_REPAY_IN: 'Qarz qaytarildi (kirim)',
      LOAN_REPAY_OUT: 'Qarz qaytarildi (chiqim)',
      ADJUSTMENT: 'Tuzatish',
    },
    headers: ['Sana', 'Tur', 'Hisob', 'Kategoriya', 'Summa (so‘m)', 'Teglar', 'Izoh'],
    sheet: 'Tranzaksiyalar',
  },
  ru: {
    types: {
      INCOME: 'Доход',
      EXPENSE: 'Расход',
      TRANSFER_IN: 'Перевод (входящий)',
      TRANSFER_OUT: 'Перевод (исходящий)',
      LOAN_GIVEN: 'Дал в долг',
      LOAN_TAKEN: 'Взял в долг',
      LOAN_REPAY_IN: 'Долг вернули',
      LOAN_REPAY_OUT: 'Долг погашен',
      ADJUSTMENT: 'Корректировка',
    },
    headers: ['Дата', 'Тип', 'Счёт', 'Категория', 'Сумма (сум)', 'Теги', 'Комментарий'],
    sheet: 'Операции',
  },
};
