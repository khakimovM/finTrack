import { useState } from 'react';
import { AdminUsageResponse } from '@fintrack/shared';
import { Segmented } from '../../components/ui/Segmented';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { BarList } from '../../components/charts/BarList';
import { WidgetCard } from '../../features/dashboard/components/WidgetCard';
import { AdminPageHeader } from '../../features/admin/components/AdminShell';
import { ShareDonut, Stat } from '../../features/admin/components/AdminCharts';
import { useAdminUsage } from '../../features/admin/hooks/useAdminData';
import { formatCount, percentOf } from '../../features/admin/format';
import { CHANNELS, SOURCES } from '../../features/admin/labels';
import { RANGE_LABELS, rangeOf, type AdminRange } from '../../features/admin/periods';
import { formatRange } from '../../lib/format';

const RANGES: AdminRange[] = ['7d', '30d', '90d'];

const FEATURES: Array<{ key: Exclude<keyof AdminUsageResponse['features'], 'users'>; label: string }> = [
  { key: 'withSeveralAccounts', label: '2 va undan ko‘p hisob' },
  { key: 'withOwnCategory', label: 'O‘z kategoriyasi' },
  { key: 'withDebt', label: 'Qarzlar' },
  { key: 'withBudget', label: 'Byudjet' },
  { key: 'withRecurring', label: 'Takroriy to‘lov' },
  { key: 'withTag', label: 'Teglar' },
  // The last three are settings: "switched on".
  { key: 'telegramNotifications', label: 'Telegram xabarlari' },
  { key: 'dailyDigest', label: 'Kunlik xulosa' },
  { key: 'strictMode', label: 'Qat’iy rejim' },
];

/** The API's failure reasons (assistant.types PROVIDER_FAILURES). */
const FAILURE_LABELS: Record<string, string> = {
  rate_limited: 'Limit',
  unavailable: 'Ishlamadi',
  rejected: 'Rad etdi',
  bad_output: 'Noto‘g‘ri javob',
};

function Assistant({ data }: { data: AdminUsageResponse['assistant'] }) {
  const total = (['voice', 'text'] as const).reduce((sum, k) => sum + data[k].ok + data[k].limit + data[k].unavailable, 0);
  if (total === 0 && data.providers.every((p) => p.ok + p.failed === 0)) {
    return <EmptyState variant="widget" title="Bu davrda yordamchidan foydalanilmagan" className="min-h-[140px]" />;
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(['voice', 'text'] as const).map((kind) => (
          <Stat
            key={kind}
            label={kind === 'voice' ? 'Ovozli so‘rovlar' : 'Matnli so‘rovlar'}
            value={formatCount(data[kind].ok)}
            hint={`limit: ${formatCount(data[kind].limit)} · ishlamadi: ${formatCount(data[kind].unavailable)}`}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold">Provayderlar</h3>
        <ul className="flex flex-col divide-y divide-border rounded-[14px] border border-border">
          {data.providers.map((p) => {
            const failures = Object.entries(p.failures).filter(([, n]) => n > 0);
            return (
              <li key={p.name} className="flex flex-col gap-1 px-3.5 py-2.5 text-[14px] sm:flex-row sm:items-center sm:gap-4">
                <span className="w-24 font-semibold capitalize">{p.name}</span>
                <span className="tabular-nums text-text-secondary">
                  {formatCount(p.ok)} muvaffaqiyatli · {formatCount(p.failed)} xato
                  {p.ok + p.failed > 0 && ` (${percentOf(p.ok, p.ok + p.failed)}% ishladi)`}
                </span>
                {failures.length > 0 && (
                  <span className="text-[13px] text-text-muted sm:ml-auto">
                    {failures.map(([reason, n]) => `${FAILURE_LABELS[reason] ?? reason}: ${formatCount(n)}`).join(' · ')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** How FinTrack is used: where people come from, where entries are made, which features, the AI assistant. */
export function AdminUsagePage() {
  const [range, setRange] = useState<AdminRange>('30d');
  const usage = useAdminUsage(rangeOf(range));
  const data = usage.data;

  return (
    <>
      <AdminPageHeader
        title="Foydalanish"
        subtitle={data ? formatRange(data.from, data.to) : undefined}
        actions={
          <Segmented
            aria-label="Davr"
            size="sm"
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
          />
        }
      />

      {usage.isError ? (
        <ErrorState
          variant="widget"
          title="Ma’lumotni yuklab bo‘lmadi"
          onRetry={() => void usage.refetch()}
          className="rounded-xl border border-border bg-card"
        />
      ) : !data ? (
        <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[260px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-3 sm:gap-4 xl:grid-cols-2">
          <WidgetCard title="Faol foydalanuvchilar kanallar bo‘yicha">
            <ShareDonut
              ariaLabel="Faol foydalanuvchilar kanallar bo‘yicha"
              centerLabel="faol"
              total={data.activeUsers.total}
              items={CHANNELS.map((c) => ({ ...c, value: data.activeUsers[c.key] }))}
            />
            <p className="text-[13px] text-text-muted">Bir odam bir nechta kanaldan foydalanishi mumkin, shuning uchun ulushlar kanallar orasida.</p>
          </WidgetCard>

          <WidgetCard title="Yozuvlar qayerdan">
            {data.entries.total > 0 ? (
              <BarList
                items={SOURCES.map((s) => ({
                  key: s.key,
                  label: s.label,
                  value: data.entries[s.key],
                  color: s.color,
                  display: `${formatCount(data.entries[s.key])} · ${percentOf(data.entries[s.key], data.entries.total)}%`,
                }))}
              />
            ) : (
              <EmptyState variant="widget" title="Bu davrda yozuv bo‘lmagan" className="min-h-[160px]" />
            )}
          </WidgetCard>

          <WidgetCard title="Funksiyalar" extra={<span className="text-[13px] text-text-secondary">hozirgi {formatCount(data.features.users)} foydalanuvchidan</span>}>
            {data.features.users > 0 ? (
              <BarList
                items={FEATURES.map((f, i) => ({
                  key: f.key,
                  label: f.label,
                  value: data.features[f.key],
                  color: `var(--chart-${(i % 8) + 1})`,
                  display: `${formatCount(data.features[f.key])} · ${percentOf(data.features[f.key], data.features.users)}%`,
                }))}
              />
            ) : (
              <EmptyState variant="widget" title="Hali foydalanuvchi yo‘q" className="min-h-[160px]" />
            )}
          </WidgetCard>

          <WidgetCard title="AI yordamchi">
            <Assistant data={data.assistant} />
          </WidgetCard>
        </div>
      )}
    </>
  );
}
