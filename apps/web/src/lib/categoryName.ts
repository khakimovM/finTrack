import { t } from './i18n';

/**
 * A category row of the stats. The stats name the uncategorised share themselves, in Uzbek and
 * cached for every reader, so the reader's language names it here.
 */
export function statsCategoryName(item: { categoryId: string | null; name: string }): string {
  return item.categoryId === null ? t('common.otherCategory') : item.name;
}
