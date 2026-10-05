import { useAuthStore } from '../../stores/authStore';
import { usePeriodStore } from '../../stores/periodStore';
import { PageHeader } from '../../components/layout/PageHeader';
import { ErrorState } from '../../components/ui/ErrorState';
import { useStatsBalanceTrend, useStatsSummary } from '../../features/dashboard/hooks/useDashboard';
import { useTransactions } from '../../features/transactions/hooks/useTransactions';
import { useAccounts } from '../../features/accounts/hooks/useAccounts';
import { VS_TEXT } from '../../features/dashboard/periods';
import { DashboardPeriod } from '../../features/dashboard/components/DashboardPeriod';
import { KpiGrid } from '../../features/dashboard/components/KpiGrid';
import { ExpenseRatioCard } from '../../features/dashboard/components/ExpenseRatioCard';
import { FlowChartCard } from '../../features/dashboard/components/FlowChartCard';
import { CategoryBarsCard, ExpenseShareCard } from '../../features/dashboard/components/CategoryCharts';
import { BalanceTrendCard } from '../../features/dashboard/components/BalanceTrendCard';
import { BudgetsWidget, DebtsWidget, RecentTransactionsCard } from '../../features/dashboard/components/BottomWidgets';
import { FirstSteps } from '../../features/dashboard/components/FirstSteps';

/**
 * Home: period, four KPIs, the expense ratio, charts and widgets. Each widget loads and fails on
 * its own; a user with no entries at all gets the first-steps checklist instead of empty charts.
 */
export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const preset = usePeriodStore((s) => s.preset);
  const summary = useStatsSummary();
  const trend = useStatsBalanceTrend();
  // Same query as the recent-transactions widget; its total tells whether anything was ever recorded.
  const recent = useTransactions({ limit: 5 });
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];
  const empty = recent.data?.meta.total === 0;
  const hasAccount = accounts.length > 1 || accounts.some((a) => BigInt(a.openingBalance) !== 0n);

  return (
    <>
      <PageHeader title="Bosh sahifa" subtitle={`Xush kelibsiz, ${user?.name ?? ''}!`} quickAdd />
      <DashboardPeriod />
      {empty && <FirstSteps hasAccount={hasAccount} />}

      {summary.isError ? (
        <ErrorState
          variant="widget"
          title="Statistikani yuklab bo‘lmadi"
          message="Boshqa bo‘limlar ishlayapti. Faqat shu qismni qayta yuklang."
          onRetry={() => void summary.refetch()}
          className="rounded-xl border border-border bg-card"
        />
      ) : (
        <KpiGrid summary={summary.data} trend={trend.data} isLoading={summary.isLoading} vsText={VS_TEXT[preset]} empty={empty} />
      )}

      {!empty && (
        <>
          {!summary.isError && <ExpenseRatioCard summary={summary.data} isLoading={summary.isLoading} />}
          <div className="grid gap-3 sm:gap-4 xl:grid-cols-12">
            <FlowChartCard />
            <ExpenseShareCard />
          </div>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <CategoryBarsCard />
            <BalanceTrendCard />
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            <BudgetsWidget />
            <RecentTransactionsCard />
            <DebtsWidget />
          </div>
        </>
      )}
    </>
  );
}
