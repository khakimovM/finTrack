import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { AdminAuditActionName, AdminAuditLogEntry } from '@fintrack/shared';
import { Chip, type ChipTone } from '../../components/ui/Chip';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { AdminPageHeader } from '../../features/admin/components/AdminShell';
import { useAdminAudit } from '../../features/admin/hooks/useAdminData';
import { formatCount } from '../../features/admin/format';
import { formatDateTime } from '../../lib/format';

const ACTIONS: Record<AdminAuditActionName, { label: string; tone: ChipTone }> = {
  LOGIN: { label: 'Kirish', tone: 'info' },
  LOGIN_DENIED: { label: 'Rad etilgan kirish', tone: 'warning' },
  LOGOUT: { label: 'Chiqish', tone: 'neutral' },
  BAN: { label: 'Bloklash', tone: 'danger' },
  UNBAN: { label: 'Blokdan chiqarish', tone: 'success' },
  REVOKE_SESSIONS: { label: 'Sessiyalar tugatildi', tone: 'warning' },
  BROADCAST: { label: 'Xabar tarqatish', tone: 'info' },
  EXPORT: { label: 'Eksport', tone: 'neutral' },
};

const DENIED: Record<string, string> = {
  not_admin: 'admin ro‘yxatida yo‘q',
  no_account: 'botda ro‘yxatdan o‘tmagan',
};

const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);

/** One line about what happened, from the entry's details. */
export function describeAudit(entry: AdminAuditLogEntry): string {
  const meta = entry.meta ?? {};
  switch (entry.action) {
    case 'LOGIN_DENIED': {
      const who = [entry.telegramId && `Telegram ID ${entry.telegramId}`, text(meta.username) && `@${text(meta.username)}`].filter(Boolean);
      return [who.join(', '), DENIED[text(meta.reason) ?? ''] ?? text(meta.reason)].filter(Boolean).join(' — ');
    }
    case 'BAN':
      return `Sabab: ${text(meta.reason) ?? '—'} · ${text(meta.sessions) ?? 0} sessiya tugatildi`;
    case 'UNBAN':
      return meta.reason ? `Avvalgi sabab: ${text(meta.reason)}` : '';
    case 'REVOKE_SESSIONS':
      return `${text(meta.sessions) ?? 0} sessiya tugatildi`;
    case 'EXPORT': {
      const filters = [text(meta.status) !== 'all' && text(meta.status), text(meta.q) && `“${text(meta.q)}”`].filter(Boolean);
      return `${formatCount(Number(meta.rows ?? 0))} qator${filters.length ? ` · filtr: ${filters.join(', ')}` : ''}`;
    }
    default:
      return '';
  }
}

/** Everything done in the panel and every refused attempt to get in, newest first. */
export function AdminAuditPage() {
  const [action, setAction] = useState<AdminAuditActionName | ''>('');
  const [page, setPage] = useState(1);
  const audit = useAdminAudit({ action: action || undefined, page, limit: 50 });
  const data = audit.data;

  return (
    <>
      <AdminPageHeader
        title="Audit jurnali"
        subtitle="Admin paneldagi har bir amal va rad etilgan kirish urinishlari"
        actions={
          <Select
            aria-label="Amal turi"
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AdminAuditActionName | '');
              setPage(1);
            }}
            options={[{ value: '', label: 'Barcha amallar' }, ...Object.entries(ACTIONS).map(([value, a]) => ({ value, label: a.label }))]}
            wrapperClassName="w-[220px]"
          />
        }
      />

      <section className="rounded-xl border border-border bg-card">
        {audit.isLoading ? (
          <div className="flex flex-col gap-2.5 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[52px] w-full" />
            ))}
          </div>
        ) : audit.isError ? (
          <ErrorState variant="widget" title="Jurnalni yuklab bo‘lmadi" onRetry={() => void audit.refetch()} />
        ) : data && data.data.length > 0 ? (
          <ul className="ft-stagger flex flex-col divide-y divide-border">
            {data.data.map((entry) => {
              const meta = ACTIONS[entry.action];
              const details = describeAudit(entry);
              return (
                <li key={entry.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-[150px] shrink-0 text-[13px] tabular-nums text-text-secondary">{formatDateTime(entry.createdAt)}</span>
                  <span className="shrink-0 sm:w-[180px]">
                    <Chip tone={meta.tone} size="sm">
                      {meta.label}
                    </Chip>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-[14px]">
                    <span className="truncate">
                      {entry.admin ? <span className="font-medium">{entry.admin.name}</span> : <span className="text-text-muted">Noma’lum odam</span>}
                      {entry.target && (
                        <>
                          {' → '}
                          <Link to={`/admin/users?open=${entry.target.id}`} className="font-medium underline decoration-input underline-offset-[3px] hover:decoration-text">
                            {entry.target.name ?? 'o‘chirilgan hisob'}
                          </Link>
                        </>
                      )}
                    </span>
                    {details && <span className="break-words text-[13px] text-text-secondary">{details}</span>}
                  </span>
                  {entry.ipAddress && <span className="shrink-0 font-mono text-[12px] text-text-muted">{entry.ipAddress}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<ScrollText className="h-6 w-6" aria-hidden />} title={action ? 'Bunday amal hali bo‘lmagan' : 'Jurnal bo‘sh'} />
        )}
      </section>

      {data && data.meta.totalPages > 1 && (
        <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} />
      )}
    </>
  );
}
