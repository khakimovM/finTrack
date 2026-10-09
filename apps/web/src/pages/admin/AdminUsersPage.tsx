import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Download, Users } from 'lucide-react';
import {
  AdminUserFilter,
  AdminUserFilterSchema,
  AdminUserSort,
  AdminUserSortSchema,
} from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { AdminPageHeader } from '../../features/admin/components/AdminShell';
import { UserList } from '../../features/admin/components/UserList';
import { UserDetailModal } from '../../features/admin/components/UserDetailModal';
import { useAdminUsers, useAdminUsersExport } from '../../features/admin/hooks/useAdminData';
import { adminToday } from '../../features/admin/periods';
import { formatCount } from '../../features/admin/format';
import { triggerDownload } from '../../features/transactions/api/transactions.api';
import { apiErrorToMessage } from '../../lib/apiError';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { toast } from '../../stores/toastStore';

const LIMIT = 25;

const STATUS_TABS: Array<{ value: AdminUserFilter; label: string }> = [
  { value: 'all', label: 'Hammasi' },
  { value: 'active', label: 'Faol' },
  { value: 'banned', label: 'Bloklangan' },
  { value: 'botBlocked', label: 'Botni bloklagan' },
  { value: 'deleted', label: 'O‘chirilgan' },
];

const SORT_OPTIONS: Array<{ value: AdminUserSort; label: string }> = [
  { value: 'newest', label: 'Avval yangilari' },
  { value: 'oldest', label: 'Avval eskilari' },
  { value: 'lastSeen', label: 'Oxirgi faollik' },
  { value: 'entries', label: 'Ko‘p yozuv' },
  { value: 'name', label: 'Ism (A–Z)' },
];

/** A failed blob request carries its JSON error as a Blob; read it so the real reason is shown. */
async function blobErrorMessage(err: unknown): Promise<string> {
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      err.response.data = JSON.parse(await err.response.data.text()) as unknown;
    } catch {
      return 'Faylni yuklab bo‘lmadi. Qayta urinib ko‘ring';
    }
  }
  return apiErrorToMessage(err);
}

/** Everyone who signed up: search, filter, sort, export, and a card per person. State lives in the URL. */
export function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const status = AdminUserFilterSchema.catch('all').parse(params.get('status') ?? undefined);
  const sort = AdminUserSortSchema.catch('newest').parse(params.get('sort') ?? undefined);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';
  const openId = params.get('open');
  const [search, setSearch] = useState(q);
  const isTable = useMediaQuery('(min-width: 1024px)');
  const today = adminToday();

  // The search debounce fires from an older render; reading the latest params keeps a card opened
  // in the meantime (`?open=`) from being dropped by a stale copy.
  const latest = useRef({ params, setParams });
  latest.current = { params, setParams };
  const update = (changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(latest.current.params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete('page');
    latest.current.setParams(next, { replace: true });
  };

  // Typing settles for a moment before it becomes a request.
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = setTimeout(() => update({ q: search.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = { q: q || undefined, status, sort, page, limit: LIMIT };
  const users = useAdminUsers(query);
  const exporter = useAdminUsersExport();
  const data = users.data;

  const exportCsv = async () => {
    try {
      const blob = await exporter.mutateAsync({ q: q || undefined, status, sort });
      triggerDownload(blob, `fintrack-foydalanuvchilar_${today}.csv`);
      toast.success('Ro‘yxat yuklab olindi');
    } catch (err: unknown) {
      toast.error(await blobErrorMessage(err));
    }
  };

  const filtered = q !== '' || status !== 'all';

  return (
    <>
      <AdminPageHeader
        title="Foydalanuvchilar"
        subtitle={data ? `${formatCount(data.meta.total)} ta${filtered ? ' (filtr bo‘yicha)' : ''}` : undefined}
        actions={
          <Button variant="outline" onClick={() => void exportCsv()} loading={exporter.isPending} disabled={!data?.meta.total}>
            <Download className="h-4 w-4" aria-hidden />
            CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Ism, @username yoki Telegram ID"
          aria-label="Foydalanuvchini qidirish"
          className="lg:w-[340px]"
        />
        <Select
          aria-label="Saralash"
          value={sort}
          onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}
          options={SORT_OPTIONS}
          wrapperClassName="lg:w-[200px]"
        />
      </div>
      <Tabs
        aria-label="Holat"
        value={status}
        onChange={(value) => update({ status: value === 'all' ? null : value })}
        items={STATUS_TABS}
      />

      <section className="rounded-xl border border-border bg-card max-lg:border-0 max-lg:bg-transparent">
        {users.isLoading ? (
          <div className="flex flex-col gap-2.5 p-0 lg:p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[58px] w-full" />
            ))}
          </div>
        ) : users.isError ? (
          <ErrorState variant="widget" title="Ro‘yxatni yuklab bo‘lmadi" onRetry={() => void users.refetch()} />
        ) : data && data.data.length > 0 ? (
          <UserList users={data.data} today={today} variant={isTable ? 'table' : 'cards'} onOpen={(id) => update({ open: id }, false)} />
        ) : (
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden />}
            title={filtered ? 'Hech kim topilmadi' : 'Hali hech kim ro‘yxatdan o‘tmagan'}
            description={filtered ? 'Qidiruvni yoki holat filtrini o‘zgartiring.' : undefined}
            action={
              filtered ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    update({ q: null, status: null });
                  }}
                >
                  Filtrlarni tozalash
                </Button>
              ) : undefined
            }
          />
        )}
      </section>

      {data && data.meta.totalPages > 1 && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          limit={data.meta.limit}
          onPageChange={(next) => update({ page: next === 1 ? null : String(next) }, false)}
        />
      )}

      <UserDetailModal userId={openId} today={today} onClose={() => update({ open: null }, false)} />
    </>
  );
}
