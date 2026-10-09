import { AdminSystemResponse } from '@fintrack/shared';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { WidgetCard } from '../../features/dashboard/components/WidgetCard';
import { AdminPageHeader } from '../../features/admin/components/AdminShell';
import { Stat } from '../../features/admin/components/AdminCharts';
import { useAdminSystem } from '../../features/admin/hooks/useAdminData';
import { formatBytes, formatCount, formatUptime } from '../../features/admin/format';
import { formatDateTime } from '../../lib/format';

const QUEUE_LABELS: Record<string, string> = {
  recurring: 'Takroriy to‘lovlar',
  'debt-reminders': 'Qarz eslatmalari',
  'telegram-outbox': 'Telegram xabarlari',
  'daily-digest': 'Kunlik xulosa',
};

function Health({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <Chip tone={ok ? 'success' : 'danger'} size="sm" dot>
      {label ?? (ok ? 'Ishlayapti' : 'Ishlamayapti')}
    </Chip>
  );
}

function Queues({ queues }: { queues: AdminSystemResponse['queues'] }) {
  const failures = queues.flatMap((q) => q.recentFailures.map((f) => ({ ...f, queue: q.name })));
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[14px]">
          <thead>
            <tr className="border-b border-border text-left text-[12px] text-text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Navbat
              </th>
              {['Kutmoqda', 'Ishlanmoqda', 'Keyinga qoldirilgan', 'Xato', 'Bajarilgan'].map((h) => (
                <th key={h} scope="col" className="px-2 py-2 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queues.map((q) => (
              <tr key={q.name} className="border-b border-border last:border-b-0">
                <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                  <span className="flex items-center gap-2">
                    {QUEUE_LABELS[q.name] ?? q.name}
                    {q.counts?.paused && <Chip size="sm">to‘xtatilgan</Chip>}
                    {!q.counts && <Health ok={false} label="O‘qib bo‘lmadi" />}
                  </span>
                </th>
                {(['waiting', 'active', 'delayed', 'failed', 'completed'] as const).map((key) => (
                  <td
                    key={key}
                    className={`px-2 py-2.5 text-right tabular-nums ${key === 'failed' && (q.counts?.failed ?? 0) > 0 ? 'font-semibold text-danger' : ''}`}
                  >
                    {q.counts ? formatCount(q.counts[key]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold">Oxirgi xatolar</h3>
        {failures.length === 0 ? (
          <p className="text-[14px] text-text-secondary">Saqlangan xato yo‘q.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-[14px] border border-border">
            {failures.map((f, i) => (
              <li key={`${f.queue}-${i}`} className="flex flex-col gap-0.5 px-3.5 py-2.5 text-[13px]">
                <span className="font-medium text-text">
                  {QUEUE_LABELS[f.queue] ?? f.queue} · {f.job}
                  <span className="font-normal text-text-muted">
                    {' '}
                    · {f.failedAt ? formatDateTime(f.failedAt) : 'vaqti noma’lum'} · {f.attempts} urinish
                  </span>
                </span>
                <span className="break-words font-mono text-[12px] text-text-secondary">{f.reason || 'sabab yozilmagan'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Is everything up, which build is running, and what failed lately. Refreshes itself every 30 s. */
export function AdminSystemPage() {
  const system = useAdminSystem();
  const data = system.data;

  return (
    <>
      <AdminPageHeader
        title="Tizim"
        subtitle={data ? `Har 30 soniyada yangilanadi · ${formatDateTime(new Date(system.dataUpdatedAt).toISOString())}` : undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => void system.refetch()} loading={system.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Yangilash
          </Button>
        }
      />

      {system.isError && !data ? (
        <ErrorState
          variant="widget"
          title="Tizim holatini olib bo‘lmadi"
          message="Server javob bermadi. Bu sahifaning o‘zi ishlamayotgan bo‘lishi mumkin."
          onRetry={() => void system.refetch()}
          className="rounded-xl border border-border bg-card"
        />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[150px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <WidgetCard title="Ma’lumotlar bazasi" extra={<Health ok={data.database.status === 'ok'} />}>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Javob" value={data.database.latencyMs !== null ? `${data.database.latencyMs} ms` : '—'} />
                <Stat label="Hajmi" value={data.database.sizeBytes !== null ? formatBytes(data.database.sizeBytes) : '—'} />
              </div>
              <span className="truncate text-[12.5px] text-text-muted">Oxirgi migratsiya: {data.database.lastMigration ?? '—'}</span>
            </WidgetCard>
            <WidgetCard title="Redis" extra={<Health ok={data.redis.status === 'ok'} />}>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Javob" value={data.redis.latencyMs !== null ? `${data.redis.latencyMs} ms` : '—'} />
                <Stat label="Xotira" value={data.redis.usedMemoryBytes !== null ? formatBytes(data.redis.usedMemoryBytes) : '—'} />
              </div>
            </WidgetCard>
            <WidgetCard
              title="Telegram bot"
              extra={<Health ok={data.telegram.mode !== 'off' && !data.telegram.lastError} label={data.telegram.mode === 'off' ? 'O‘chiq' : undefined} />}
            >
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Rejim" value={data.telegram.mode === 'webhook' ? 'Webhook' : data.telegram.mode === 'polling' ? 'Polling' : '—'} />
                <Stat label="Navbatda" value={data.telegram.pendingUpdates !== null ? formatCount(data.telegram.pendingUpdates) : '—'} />
              </div>
              <span className="truncate text-[12.5px] text-text-muted">
                {data.telegram.lastError
                  ? `Oxirgi xato${data.telegram.lastErrorAt ? ` (${formatDateTime(data.telegram.lastErrorAt)})` : ''}: ${data.telegram.lastError}`
                  : data.telegram.webhookHost ?? 'Webhook o‘rnatilmagan'}
              </span>
            </WidgetCard>
            <WidgetCard title="Versiya">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Commit" value={<span className="font-mono text-[18px]">{data.version.commit ?? 'lokal'}</span>} />
                <Stat label="Ishlayapti" value={formatUptime(data.version.uptimeSeconds)} />
              </div>
              <span className="truncate text-[12.5px] text-text-muted">
                {data.version.environment} · Node {data.version.node} · {formatDateTime(data.version.startedAt)} dan beri
              </span>
            </WidgetCard>
          </div>
          <WidgetCard title="Fon vazifalari (navbatlar)">
            <Queues queues={data.queues} />
          </WidgetCard>
        </>
      )}
    </>
  );
}
