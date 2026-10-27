import type { TransactionType } from '@fintrack/shared';
import { t } from '../../lib/i18n';

/** How each ledger entry type is named in lists and filters. */
export function typeLabel(type: TransactionType): string {
  return t(`txTypes.${type}`);
}
