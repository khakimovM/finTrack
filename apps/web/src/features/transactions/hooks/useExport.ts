import { useState } from 'react';
import axios from 'axios';
import { todayLocalIso } from '@fintrack/shared';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { transactionsApi, triggerDownload } from '../api/transactions.api';

export type ExportFormat = 'csv' | 'xlsx';

/** A failed blob request carries its JSON error as a Blob; read it so EXPORT_TOO_LARGE is named. */
async function exportErrorMessage(err: unknown): Promise<string> {
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      err.response.data = JSON.parse(await err.response.data.text()) as unknown;
    } catch {
      return 'Faylni yuklab bo‘lmadi. Qayta urinib ko‘ring';
    }
  }
  return apiErrorToMessage(err);
}

export function useExportTransactions() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const exportData = async (format: ExportFormat, query?: Record<string, string | undefined>) => {
    if (exporting) return;
    setExporting(format);
    try {
      const blob = format === 'csv' ? await transactionsApi.exportCsv(query) : await transactionsApi.exportXlsx(query);
      triggerDownload(blob, `tranzaksiyalar_${todayLocalIso()}.${format}`);
      toast.success('Fayl yuklab olindi');
    } catch (err: unknown) {
      toast.error(await exportErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  return { exportData, exporting, isExporting: exporting !== null };
}
