import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { AdminOverviewResponse } from '@fintrack/shared';
import { KpiCard } from '../../components/ui/KpiCard';
import { ChangeChip } from '../../components/ui/Chip';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { WidgetCard, WidgetState } from '../../features/dashboard/components/WidgetCard';
import { AdminPageHeader } from '../../features/admin/components/AdminShell';
import { GrowthChart, Legend, ShareDonut, Stat, seriesOf } from '../../features/admin/components/AdminCharts';
import { useAdminGrowth, useAdminOverview, useAdminUsage, useAdminUsers } from '../../features/admin/hooks/useAdminData';
import { changePercent, formatCount, percentOf } from '../../features/admin/format';
import { CHANNELS, SOURCES } from '../../features/admin/labels';
import { BarList } from '../../components/charts/BarList';
import { rangeOf } from '../../features/admin/periods';
import { formatDate, formatRelativeDay } from '../../lib/format';

const TREND = seriesOf(['activeUsers', 'newUsers']);

function Kpis({ data }: { data: AdminOverviewResponse | undefined }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <KpiCard key={i} label="" value="" loading />
        ))}
      </div>
    );
  }
  const { users, entries } = data;
  const vs = 'oldingi davrga nisbatan';
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Foydalanuvchilar"
        value={formatCount(users.total)}
        change={<ChangeChip value={changePercent(users.new7d.current, users.new7d.previous)} upIsGood />}
        vsText={`7 kunda +${formatCount(users.new7d.current)}`}
        sub={`Bugun +${formatCount(users.newToday)}, 30 kunda +${formatCount(users.new30d.current)}`}
      />
      <KpiCard
        label="Bugun faol"
        value={formatCount(users.activeToday)}
        change={<ChangeChip value={changePercent(users.active7d.current, users.active7d.previous)} upIsGood />}
        vsText={`7 kunda ${formatCount(users.active7d.current)}`}
        sub={vs}
      />
      <KpiCard
        label="30 kunda faol"
        value={formatCount(users.active30d.current)}
        change={<ChangeChip value={changePercent(users.active30d.current, users.active30d.previous)} upIsGood />}
        vsText={vs}
        sub={users.total > 0 ? `Foydalanuvchilarning ${Math.round((users.active30d.current / users.total) * 100)}%` : undefined}
      />
      <KpiCard
        label="Yozuvlar, 7 kun"
        value={formatCount(entries.last7d.current)}
        change={<ChangeChip value={changePercent(entries.last7d.current, entries.last7d.previous)} upIsGood />}
        vsText={vs}
        sub={`Bugun ${formatCount(entries.today)}, jami ${formatCount(entries.total)}`}
      />
    </div>
  );
}

function NewestUsers() {
  const newest = useAdminUsers({ sort: 'newest', limit: 6 });
  return (
    <WidgetCard title="Yangi ro‘yxatdan o‘tganlar" to="/admin/users" className="xl:col-span-5">
      <WidgetState
        isLoading={newest.isLoading}
        isError={newest.isError}
        onRetry={() => void newest.refetch()}
        errorTitle="Ro‘yxatni yuklab bo‘lmadi"
        skeleton={<Skeleton className="h-[264px] w-full" />}
      >
        {newest.data?.data.length ? (
          <ul className="-my-1 flex flex-col">
            {newest.data.data.map((user) => (
              <li key={user.id}>
                <Link
                  to={`/admin/users?open=${user.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors duration-fast hover:bg-secondary focus-ring"
                >
                  <Avatar name={user.name} size={36} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium">{user.name}</span>
                    <span className="truncate text-[13px] text-text-muted">
                      {user.telegramUsername ? `@${user.telegramUsername}` : 'username yo‘q'}
                    </span>
                  </span>
                  <span className="text-[13px] text-text-secondary">{formatRelativeDay(user.createdAt.slice(0, 10), rangeOf('7d').to)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState variant="widget" icon={<UserPlus className="h-6 w-6" aria-hidden />} title="Hali hech kim ro‘yxatdan o‘tmagan" />
        )}
      </WidgetState>
    </WidgetCard>
  );
}

/** The first page of the panel: how many people, how active, what is new. */
export function AdminOverviewPage() {
  const overview = useAdminOverview();
  const month = rangeOf('30d');
  const growth = useAdminGrowth(month, 'day');
  const usage = useAdminUsage(month);
  const data = overview.data;

  return (
    <>
      <AdminPageHeader
        title="Umumiy ko‘rinish"
        subtitle={data ? `${formatDate(data.today)} · raqamlar bir daqiqagacha kechikishi mumkin` : undefined}
      />
      {overview.isError ? (
        <ErrorState
          variant="widget"
          title="Ko‘rsatkichlarni yuklab bo‘lmadi"
          onRetry={() => void overview.refetch()}
          className="rounded-xl border border-border bg-card"
        />
      ) : (
        <Kpis data={data} />
      )}

      {data && (
        <section aria-label="Hisoblar holati" className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 sm:px-6 sm:py-5">
          <Stat label="Botni bloklagan" value={formatCount(data.users.botBlocked)} />
          <Stat label="Bloklangan" value={formatCount(data.users.banned)} />
          <Stat label="O‘chirilgan" value={formatCount(data.users.deleted)} />
        </section>
      )}

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-12">
        <WidgetCard title="So‘nggi 30 kun" extra={<Legend series={TREND} />} className="xl:col-span-8">
          <WidgetState
            isLoading={growth.isLoading}
            isError={growth.isError}
            onRetry={() => void growth.refetch()}
            skeleton={<Skeleton className="h-[220px] w-full" />}
          >
            <GrowthChart points={growth.data?.points ?? []} groupBy="day" series={TREND} ariaLabel="Faol va yangi foydalanuvchilar grafigi" />
          </WidgetState>
        </WidgetCard>
        <WidgetCard title="Kanallar, 30 kun" className="xl:col-span-4">
          <WidgetState
            isLoading={usage.isLoading}
            isError={usage.isError}
            onRetry={() => void usage.refetch()}
            skeleton={<Skeleton className="h-[220px] w-full" />}
          >
            {usage.data && (
              <ShareDonut
                ariaLabel="Faol foydalanuvchilar kanallar bo‘yicha"
                centerLabel="faol"
                total={usage.data.activeUsers.total}
                items={CHANNELS.map((c) => ({ ...c, value: usage.data.activeUsers[c.key] }))}
              />
            )}
          </WidgetState>
        </WidgetCard>
      </div>

      <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-12">
        <WidgetCard title="Yozuvlar qayerdan, 30 kun" className="xl:col-span-7">
          <WidgetState
            isLoading={usage.isLoading}
            isError={usage.isError}
            onRetry={() => void usage.refetch()}
            skeleton={<Skeleton className="h-[220px] w-full" />}
          >
            {usage.data && usage.data.entries.total > 0 ? (
              <BarList
                items={SOURCES.map((s) => ({
                  key: s.key,
                  label: s.label,
                  value: usage.data.entries[s.key],
                  color: s.color,
                  display: `${formatCount(usage.data.entries[s.key])} · ${percentOf(usage.data.entries[s.key], usage.data.entries.total)}%`,
                }))}
              />
            ) : (
              <EmptyState variant="widget" title="30 kunda yozuv bo‘lmagan" className="min-h-[180px]" />
            )}
          </WidgetState>
        </WidgetCard>
        <NewestUsers />
      </div>
    </>
  );
}
