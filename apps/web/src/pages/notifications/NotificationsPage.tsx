import { useState } from 'react';
import { BellOff, CheckCheck } from 'lucide-react';
import type { NotificationResponse } from '@fintrack/shared';
import { todayLocalIso } from '@fintrack/shared';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useNotifications,
} from '../../features/notifications/hooks/useNotifications';
import { NotificationItem } from '../../features/notifications/components/NotificationItem';
import { useOpenNotification } from '../../features/notifications/components/NotificationBell';
import { localDay, notificationDayLabel } from '../../features/notifications/notificationMeta';

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Newest first, grouped under "Bugun", "Kecha" and dated headings. */
function groupByDay(items: NotificationResponse[], today: string) {
  const yesterday = shiftDay(today, -1);
  const groups: Array<{ label: string; items: NotificationResponse[] }> = [];
  for (const item of items) {
    const label = notificationDayLabel(localDay(item.createdAt), today, yesterday);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const all = useNotifications();
  const unreadList = useNotifications(true);
  const query = filter === 'unread' ? unreadList : all;
  const markAll = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();
  const openItem = useOpenNotification();
  const today = todayLocalIso();
  const unread = all.data?.meta.unreadCount ?? 0;
  const items = query.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Bildirishnomalar"
        subtitle={unread > 0 ? `${unread} ta o‘qilmagan` : 'Hammasi o‘qilgan'}
        quickAdd
        backTo="/app"
      />
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs
            aria-label="Bildirishnomalar"
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: 'Hammasi' },
              { value: 'unread', label: 'O‘qilmagan', badge: unread },
            ]}
          />
          <Button variant="ghost" size="sm" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck className="h-4 w-4" aria-hidden />
            Barchasini o‘qilgan qilish
          </Button>
        </div>

        <div className="-mx-2 min-h-[320px] sm:mx-0 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-2">
          {query.isLoading ? (
            <div className="flex flex-col gap-1 p-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 p-2">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-[13px] w-1/2" />
                    <Skeleton className="h-[11px] w-4/5" />
                    <Skeleton className="h-[10px] w-1/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState title="Bildirishnomalarni yuklab bo‘lmadi" onRetry={() => void query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<BellOff />}
              title="Hozircha yangi bildirishnomalar yo‘q"
              description="Byudjet, qarz muddati yoki takroriy to‘lov bo‘yicha xabarlar shu yerda chiqadi."
              className="py-12"
            />
          ) : (
            groupByDay(items, today).map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="px-3 pb-1.5 pt-3 text-[12px] font-semibold text-text-muted">{group.label}</h2>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      today={today}
                      variant="page"
                      onOpen={openItem}
                      onDelete={(item) => remove.mutate(item.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}
