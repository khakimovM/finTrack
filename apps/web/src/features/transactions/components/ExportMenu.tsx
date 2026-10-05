import { ChevronDown, Download, LoaderCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { useExportTransactions, type ExportFormat } from '../hooks/useExport';

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

const FORMATS: { format: ExportFormat; ext: string; label: string }[] = [
  { format: 'csv', ext: 'CSV', label: 'CSV formatida' },
  { format: 'xlsx', ext: 'XLS', label: 'Excel (XLSX) formatida' },
];

export function ExportMenu({ query, variant = 'button', heading, doneMessage }: ExportMenuProps) {
  const { exportData, exporting } = useExportTransactions(doneMessage);

  const items: MenuItem[] = FORMATS.map(({ format, ext, label }) => ({
    label: exporting === format ? 'Yuklanmoqda...' : label,
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
      label="Eksport"
      sheetTitle="Eksport"
      width={heading ? 270 : 250}
      header={heading}
      className={variant === 'wide' ? 'flex w-full' : undefined}
      items={items}
      trigger={(props) =>
        variant === 'icon' ? (
          <button
            {...props}
            type="button"
            aria-label="Eksport"
            className="flex h-11 w-11 items-center justify-center rounded-full text-text hover:bg-secondary focus-ring"
          >
            {exporting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
          </button>
        ) : (
          <Button {...props} variant="outline" className={variant === 'wide' ? 'h-11 w-full aria-expanded:bg-secondary' : 'aria-expanded:bg-secondary'}>
            {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {exporting ? 'Yuklanmoqda...' : 'Eksport'}
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" aria-hidden />
          </Button>
        )
      }
    />
  );
}
