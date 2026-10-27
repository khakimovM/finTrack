import { useMemo, useState } from 'react';
import { CalendarRange, ChartColumn } from 'lucide-react';
import { todayLocalIso } from '@fintrack/shared';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { PageHeader } from '../../components/layout/PageHeader';
import { formatRange } from '../../lib/format';
import { ExportMenu } from '../../features/transactions/components/ExportMenu';
import { comparisonFor, type DateRange, type ReportPreset } from '../../features/reports/periods';
import { bucketPlan } from '../../features/reports/buckets';
import { useReport } from '../../features/reports/useReport';
import { ReportPeriodPicker } from '../../features/reports/components/ReportPeriodPicker';
import { CategoryCompare, CompareCards, PeriodChart } from '../../features/reports/components/ReportParts';
import { t } from '../../lib/i18n';

const CARD = 'rounded-[20px] border border-border bg-card';

export function ReportsPage() {
  const today = todayLocalIso();
  const [preset, setPreset] = useState<ReportPreset>('this_month');
  const [custom, setCustom] = useState<DateRange>({ from: `${today.slice(0, 8)}01`, to: today });

  const comparison = useMemo(() => comparisonFor(preset, today, custom), [preset, today, custom]);
  const plan = useMemo(() => bucketPlan(preset, comparison), [preset, comparison]);
  const report = useReport(comparison, plan);
  const data = report.compare;
  const hasActivity = data && (data.current.transactionCount > 0 || data.previous.transactionCount > 0);
  const range = formatRange(comparison.current.from, comparison.current.to);

  const exportProps = {
    query: { from: comparison.current.from, to: comparison.current.to },
    heading: range,
    doneMessage: t('reports.page.exported'),
  };

  let body;
  if (report.isLoading)
    body = (
      <div role="status" aria-label={t('transactions.page.loading')} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${CARD} flex flex-col gap-2.5 p-5`}>
              <Skeleton className="h-[13px] w-2/5" />
              <Skeleton className="h-7 w-[70%]" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-[20px]" />
      </div>
    );
  else if (report.isError) body = <ErrorState title={t('reports.page.loadFailed')} onRetry={report.refetch} className={CARD} />;
  else if (!data || !hasActivity)
    body = (
      <EmptyState
        icon={<ChartColumn className="h-6 w-6" aria-hidden />}
        title={t('reports.page.empty')}
        description={t('reports.page.emptyText')}
        className={CARD}
      />
    );
  else
    body = (
      <>
        <CompareCards data={data} />
        {report.series && <PeriodChart plan={plan} comparison={comparison} series={report.series} />}
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-2">
          <CategoryCompare title={t('reports.page.expenseByCategory')} rows={report.expense} type="expense" />
          <CategoryCompare title={t('reports.page.incomeByCategory')} rows={report.income} type="income" />
        </div>
      </>
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('nav.reports')}
        subtitle={t('reports.page.subtitle')}
        actions={<ExportMenu {...exportProps} />}
        mobileActions={<ExportMenu {...exportProps} variant="wide" />}
      />
      <div className="flex flex-col gap-2.5">
        <ReportPeriodPicker preset={preset} custom={custom} onPresetChange={setPreset} onCustomChange={setCustom} />
        <p className="flex items-center gap-2 text-pretty text-[14px] leading-5 text-text-secondary">
          <CalendarRange className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <b className="font-semibold text-text">{range}</b> {t('reports.page.andPrevious')}{' '}
            {formatRange(comparison.previous.from, comparison.previous.to)}
          </span>
        </p>
      </div>
      {body}
    </div>
  );
}
