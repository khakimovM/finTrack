import { ChevronDown, Download, LoaderCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { useExportTransactions, type ExportFormat } from '../hooks/useExport';
import { t, type TextKey } from '../../../lib/i18n';

export interface ExportMenuProps {
  /** Same filters as the list on screen: the file contains exactly what the user sees. */
  query: Record<string, string | undefined>;
  /** icon: the phone top bar; wide: a full-width phone button. */
  variant?: 'button' | 'icon' | 'wide';
  /** What the file will cover, above the formats (reports: "1–31-oktabr, 2026"). */
  heading?: string;
  /** Toast after the download. */
  doneMessage?: string;
}

const FORMATS: { format: ExportFormat; ext: string; label: TextKey }[] = [
  { format: 'csv', ext: 'CSV', label: 'transactions.export.csv' },
  { format: 'xlsx', ext: 'XLS', label: 'transactions.export.xlsx' },
];

export function ExportMenu({ query, variant = 'button', heading, doneMessage }: ExportMenuProps) {
  const { exportData, exporting } = useExportTransactions(doneMessage);

  const items: MenuItem[] = FORMATS.map(({ format, ext, label }) => ({
    label: exporting === format ? t('transactions.export.loading') : t(label),
    disabled: exporting !== null,
    onSelect: () => void exportData(format, query),
    lead: (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-secondary text-[10px] font-bold text-text-secondary">
        {exporting === format ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : ext}
      </span>
    ),
  }));

  return (
    <Menu
      label={t('transactions.export.title')}
      sheetTitle={t('transactions.export.title')}
      width={heading ? 270 : 250}
      header={heading}
      className={variant === 'wide' ? 'flex w-full' : undefined}
      items={items}
      trigger={(props) =>
        variant === 'icon' ? (
          <button
            {...props}
            type="button"
            aria-label={t('transactions.export.title')}
            className="flex h-11 w-11 items-center justify-center rounded-full text-text hover:bg-secondary focus-ring"
          >
            {exporting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
          </button>
        ) : (
          <Button {...props} variant="outline" className={variant === 'wide' ? 'h-11 w-full aria-expanded:bg-secondary' : 'aria-expanded:bg-secondary'}>
            {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {exporting ? t('transactions.export.loading') : t('transactions.export.title')}
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" aria-hidden />
          </Button>
        )
      }
    />
  );
}
