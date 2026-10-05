import { useAuthStore } from '../../stores/authStore';
import {
  useStatsSummary,
  useStatsTimeseries,
  useStatsByCategory,
  useStatsBalanceTrend,
} from '../../features/dashboard/hooks/useDashboard';
import { PeriodFilter } from '../../features/dashboard/components/PeriodFilter';
import { KpiCards } from '../../features/dashboard/components/KpiCards';
import { ExpenseProgressBar } from '../../features/dashboard/components/ExpenseProgressBar';
import { TimeseriesChart } from '../../features/dashboard/components/TimeseriesChart';
import { CategoryDonutChart } from '../../features/dashboard/components/CategoryDonutChart';
import { CategoryBarChart } from '../../features/dashboard/components/CategoryBarChart';
import { BalanceTrendChart } from '../../features/dashboard/components/BalanceTrendChart';
import { RecentTransactionsWidget } from '../../features/dashboard/components/RecentTransactionsWidget';
import { DebtSummaryWidget } from '../../features/dashboard/components/DebtSummaryWidget';
import { ErrorState } from '../../components/ui/ErrorState';
import { apiErrorToMessage } from '../../lib/apiError';
import { PageHeader } from '../../components/layout/PageHeader';

export function DashboardPage() {
  const { user } = useAuthStore();
  const header = <PageHeader title="Bosh sahifa" subtitle={`Xush kelibsiz, ${user?.name ?? ''}!`} quickAdd />;

  const summaryQuery = useStatsSummary();
  const timeseriesQuery = useStatsTimeseries();
  const categoryQuery = useStatsByCategory('EXPENSE');
  const balanceTrendQuery = useStatsBalanceTrend();

  const isAnyError =
    summaryQuery.isError ||
    timeseriesQuery.isError ||
    categoryQuery.isError ||
    balanceTrendQuery.isError;

  const handleRetryAll = () => {
    summaryQuery.refetch();
    timeseriesQuery.refetch();
    categoryQuery.refetch();
    balanceTrendQuery.refetch();
  };

  if (isAnyError) {
    const errorMsg =
      apiErrorToMessage(summaryQuery.error) ||
      apiErrorToMessage(timeseriesQuery.error) ||
      apiErrorToMessage(categoryQuery.error) ||
      apiErrorToMessage(balanceTrendQuery.error) ||
      'Statistika ma’lumotlarini yuklashda xatolik yuz berdi';

    return (
      <>
        {header}
        <ErrorState
          message={errorMsg}
          onRetry={handleRetryAll}
        />
      </>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {header}

      {/* Period Filter Bar */}
      <div className="bg-card/70 backdrop-blur-sm p-3 sm:p-4 rounded-2xl border border-border/60 shadow-sm">
        <PeriodFilter />
      </div>

      {/* 2. KPI Cards */}
      <KpiCards summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

      {/* 3. Expense Progress Bar */}
      <ExpenseProgressBar
        spentPercent={summaryQuery.data?.spentPercent}
        isLoading={summaryQuery.isLoading}
      />

      {/* 4. Primary Charts: Timeseries & Category Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TimeseriesChart
            data={timeseriesQuery.data?.data}
            isLoading={timeseriesQuery.isLoading}
          />
        </div>
        <div className="lg:col-span-1">
          <CategoryDonutChart
            items={categoryQuery.data?.items}
            total={categoryQuery.data?.total}
            isLoading={categoryQuery.isLoading}
          />
        </div>
      </div>

      {/* 5. Secondary Charts: Category Comparison Bar & Balance Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBarChart
          items={categoryQuery.data?.items}
          isLoading={categoryQuery.isLoading}
        />
        <BalanceTrendChart
          trendData={balanceTrendQuery.data}
          isLoading={balanceTrendQuery.isLoading}
        />
      </div>

      {/* 6. Bottom Widgets: Recent Transactions & Debt Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentTransactionsWidget />
        <DebtSummaryWidget />
      </div>
    </div>
  );
}
