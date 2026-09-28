import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useExportTransactions } from '../hooks/useExport';

export interface ExportMenuProps {
  /** Same filters as the list on screen: the file contains exactly what the user sees. */
  query: Record<string, string | undefined>;
}

export function ExportMenu({ query }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { exportData, isExporting } = useExportTransactions();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === 'Escape'
          : !rootRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const run = (format: 'csv' | 'xlsx') => {
    setOpen(false);
    void exportData(format, query);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        disabled={isExporting}
        onClick={() => setOpen((prev) => !prev)}
        className="gap-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="h-4 w-4" />
        <span>{isExporting ? 'Yuklanmoqda...' : 'Eksport'}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run('csv')}
            className="flex w-full items-center gap-2 px-3 py-3 text-left text-xs text-foreground hover:bg-muted/50 sm:py-2"
          >
            <FileText className="h-4 w-4 text-emerald-500" />
            <span>CSV formatida</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run('xlsx')}
            className="flex w-full items-center gap-2 px-3 py-3 text-left text-xs text-foreground hover:bg-muted/50 sm:py-2"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Excel (XLSX) formatida</span>
          </button>
        </div>
      )}
    </div>
  );
}
