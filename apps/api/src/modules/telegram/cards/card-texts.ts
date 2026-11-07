import { AppLocale } from '@fintrack/shared';
import { cardTextsUz } from './card-texts.uz';
import { cardTextsRu } from './card-texts.ru';

export type CardTexts = typeof cardTextsUz;

export const CARD_TEXTS: Record<AppLocale, CardTexts> = { uz: cardTextsUz, ru: cardTextsRu };
