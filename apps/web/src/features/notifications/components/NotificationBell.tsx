import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, ChevronRight } from 'lucide-react';
import type { NotificationResponse } from '@fintrack/shared';
import { todayLocalIso } from '@fintrack/shared';
import { cn } from '../../../lib/utils';
import { useIsMobile } from '../../../lib/useMediaQuery';
import { EXIT_MS, popMotion, usePresence } from '../../../lib/motion';
import { Button } from '../../../components/ui/Button';
import { Chip, CountBadge } from '../../../components/ui/Chip';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Sheet } from '../../../components/ui/Sheet';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useDismiss } from '../../../components/ui/Popover';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../hooks/useNotifications';
import { notificationLink } from '../notificationMeta';
import { NotificationItem } from './NotificationItem';

/** Marks the item read and goes to what it is about. */
export function useOpenNotification(afterOpen?: () => void) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  return (notification: NotificationResponse) => {
    if (notification.readAt === null) markRead.mutate(notification.id);
    afterOpen?.();
    navigate(notificationLink(notification));
  };
}

function NotificationList({ onOpen }: { onOpen: (n: NotificationResponse) => void }) {
  const { data, isLoading, isError, refetch } = useNotifications();
  const today = todayLocalIso();
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <ErrorState variant="widget" title="Bildirishnomalarni yuklab bo‘lmadi" onRetry={() => void refetch()} className="m-2 min-h-0" />;
  }
  const items = (data?.data ?? []).slice(0, 6);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <BellOff className="h-6 w-6 text-text-muted" strokeWidth={1.8} aria-hidden />
        <p className="text-[14px] text-text-muted">Hozircha yangi bildirishnomalar yo‘q</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((n) => (
        <NotificationItem key={n.id} notification={n} today={today} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** Header bell with the unread count; a popover from 640px, a full-height sheet on phones. */
export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const { data } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const unread = data?.meta.unreadCount ?? 0;
  const close = () => setOpen(false);
  const openItem = useOpenNotification(close);
  useDismiss([rootRef], open && !isMobile, close);
  const popover = usePresence(open && !isMobile, EXIT_MS.base);

  const markAllButton = (
    <Button
      variant="ghost"
      size={isMobile ? 'sm' : 'xs'}
      disabled={unread === 0 || markAll.isPending}
      onClick={() => markAll.mutate()}
    >
      <CheckCheck className="h-4 w-4" aria-hidden />
      Barchasini o‘qilgan qilish
    </Button>
  );

  const allLink = (
    <Link
      to="/app/notifications"
      onClick={close}
      className="flex h-12 items-center justify-center gap-1 border-t border-border text-[14px] font-medium text-text hover:bg-secondary focus-ring"
    >
      Barchasini ko‘rish <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Bildirishnomalar, ${unread} ta yangi` : 'Bildirishnomalar'}
        aria-expanded={open}
        className={cn(
          'relative flex items-center justify-center rounded-full transition-colors duration-fast focus-ring',
          compact ? 'h-11 w-11 text-text hover:bg-secondary' : 'h-10 w-10 border border-border',
          !compact && (open ? 'bg-secondary' : 'bg-card hover:bg-secondary'),
        )}
      >
        <Bell className={compact ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]'} aria-hidden />
        {unread > 0 && (
          <CountBadge
            count={unread}
            className={cn(
              'absolute shadow-[0_0_0_2px_var(--background)]',
              compact ? 'right-1 top-1.5 h-[18px] min-w-[18px] text-[10.5px]' : '-right-1.5 -top-1',
            )}
          />
        )}
      </button>

      {popover.mounted && (
        <div
          role="dialog"
          aria-label="Bildirishnomalar"
          aria-hidden={popover.closing || undefined}
          className={cn(
            'absolute right-0 top-[52px] z-40 w-[420px] origin-top-right overflow-hidden rounded-xl border border-border bg-popover shadow-md',
            popMotion(popover.closing),
          )}
        >
          <div className="flex items-center gap-2 px-4 pb-2.5 pt-4">
            <span className="text-[16px] font-semibold">Bildirishnomalar</span>
            {unread > 0 && (
              <Chip tone="info" size="sm" className="font-semibold">
                {unread} ta yangi
              </Chip>
            )}
            <span className="ml-auto">{markAllButton}</span>
          </div>
          <div className="max-h-[440px] overflow-y-auto px-2 pb-2">
            <NotificationList onOpen={openItem} />
          </div>
          {allLink}
        </div>
      )}

      {isMobile && (
        <Sheet
          isOpen={open}
          onClose={close}
          full
          title="Bildirishnomalar"
          headerExtra={
            unread > 0 ? (
              <Chip tone="info" size="sm" className="font-semibold">
                {unread} ta yangi
              </Chip>
            ) : undefined
          }
          bodyClassName="px-2"
        >
          <div className="px-2 pb-2">{markAllButton}</div>
          <div className="border-t border-border pt-1">
            <NotificationList onOpen={openItem} />
          </div>
          {allLink}
        </Sheet>
      )}
    </div>
  );
}
