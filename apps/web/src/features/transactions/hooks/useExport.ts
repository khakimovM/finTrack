import { useState } from 'react';
import { toast } from '../../../stores/toastStore';
import { transactionsApi, triggerDownload } from '../api/transactions.api';

export function useExportTransactions() {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async (
    format: 'csv' | 'xlsx',
    query?: Record<string, string | undefined>,
  ) => {
    try {
      setIsExporting(true);
      const dateStr = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        const blob = await transactionsApi.exportCsv(query);
        triggerDownload(blob, `tranzaksiyalar_${dateStr}.csv`);
      } else {
        const blob = await transactionsApi.exportXlsx(query);
        triggerDownload(blob, `tranzaksiyalar_${dateStr}.xlsx`);
      }

      toast.success(`${format.toUpperCase()} fayli muvaffaqiyatli yuklab olindi`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Eksport qilishda xatolik yuz berdi: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportData, isExporting };
}
