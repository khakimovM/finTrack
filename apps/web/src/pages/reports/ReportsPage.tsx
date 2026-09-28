import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { todayLocalIso } from '@fintrack/shared';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { apiErrorToMessage } from '../../lib/apiError';
import { ExportMenu } from '../../features/transactions/components/ExportMenu';
import {
  comparisonFor,
  DateRange,
  formatRange,
  ReportPreset,
} from '../../features/reports/periods';
import { useStatsCompare } from '../../features/reports/useStatsCompare';
import { ReportPeriodPicker } from '../../features/reports/components/ReportPeriodPicker';
import { CompareSummary } from '../../features/reports/components/CompareSummary';
import { CategoryCompareList } from '../../features/reports/components/CategoryCompareList';

export function ReportsPage() {
  const today = todayLocalIso();
  const [preset, setPreset] = useState<ReportPreset>('this_month');
  const [custom, setCustom] = useState<DateRange>({ from: `${today.slice(0, 8)}01`, to: today });

  const customError =
    preset !== 'custom'
      ? undefined
      : !custom.from || !custom.to
        ? 'Ikkala sanani ham tanlang'
        : custom.from > custom.to
          ? 'Tugash sanasi boshlanishdan oldin bo‘lishi mumkin emas'
          : undefined;
  const comparison = useMemo(
    () => (customError ? null : comparisonFor(preset, today, custom)),
    [preset, today, custom, customError],
  );
  const { data, isLoading, isError, error, refetch } = useStatsCompare(comparison);
  const hasActivity =
    data && (data.current.transactionCount > 0 || data.previous.transactionCount > 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            <BarChart3 className="h-7 w-7 text-primary" />
            Hisobotlar
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Davrlarni solishtirish, kategoriyalar bo‘yicha o‘zgarish va eksport
          </p>
        </div>
        {comparison && (
          <ExportMenu query={{ from: comparison.current.from, to: comparison.current.to }} />
        )}
      </div>

      <ReportPeriodPicker
        preset={preset}
        custom={custom}
        customError={customError}
        onPresetChange={setPreset}
        onCustomChange={setCustom}
      />

      {comparison && (
        <p className="text-xs text-muted-foreground">
          <b className="text-foreground">{formatRange(comparison.current)}</b> va oldingi davr{' '}
          <b className="text-foreground">{formatRange(comparison.previous)}</b>
        </p>
      )}

      {!comparison ? null : isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState message={apiErrorToMessage(error)} onRetry={() => refetch()} />
      ) : !data || !hasActivity ? (
        <EmptyState
          icon={<BarChart3 className="h-10 w-10 text-muted-foreground/60" />}
          title="Bu davrlarda yozuvlar yo‘q"
          description="Boshqa davrni tanlang yoki kirim-chiqimlaringizni yozib boring — hisobot shu yerda paydo bo‘ladi."
        />
      ) : (
        <div className="space-y-6">
          <CompareSummary data={data} />
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Xarajatlar kategoriyalar bo‘yicha</h2>
            {data.byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground">Bu davrlarda xarajat yozilmagan.</p>
            ) : (
              <CategoryCompareList items={data.byCategory} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
