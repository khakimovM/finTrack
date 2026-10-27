import { AppLocale, toAppLocale } from '@fintrack/shared';
import { Db } from '../../infra/prisma/prisma.types';

/**
 * Notes FinTrack writes on a ledger row when the user gave none. They are stored, so they are
 * written once in the owner's language and stay as written if the language changes later.
 */
export const AUTO_NOTE: Record<AppLocale, { debt: (person: string) => string; recurring: string; settled: string }> = {
  uz: { debt: (person) => `Qarz: ${person}`, recurring: 'Takroriy to‘lov', settled: 'To‘liq yopildi' },
  ru: { debt: (person) => `Долг: ${person}`, recurring: 'Регулярный платёж', settled: 'Долг закрыт полностью' },
};

export async function autoNotes(db: Db, userId: string): Promise<(typeof AUTO_NOTE)[AppLocale]> {
  const owner = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return AUTO_NOTE[toAppLocale(owner?.locale)];
}
