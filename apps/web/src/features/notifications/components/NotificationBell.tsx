import { useState, useRef, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useNotifications';
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Clock, Info } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../lib/utils';

// createdAt is UTC; format() renders it in the viewer's local time.
const SEVERE_TYPES = new Set(['BUDGET_EXCEEDED', 'DEBT_OVERDUE', 'NEGATIVE_BALANCE']);
const WARNING_TYPES = new Set(['BUDGET_WARNING', 'DEBT_DUE_SOON', 'RECURRING_SKIPPED']);

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.data ?? [];
  const unreadCount = data?.meta?.unreadCount ?? 0;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = async (id: string, isRead: boolean) => {
    if (!isRead) {
      await markRead.mutateAsync(id);
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount > 0) {
      await markAllRead.mutateAsync();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Bildirishnomalar"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border/80 bg-popover/95 p-3 text-popover-foreground shadow-2xl backdrop-blur-xl z-50 animate-in fade-in-50 zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-border/50 px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Bildirishnomalar</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                  {unreadCount} ta yangi
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMarkAll}
                className="text-[11px] h-7 text-primary hover:text-primary font-semibold"
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Barchasini o‘qilgan qilish
              </Button>
            )}
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/20">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Bell className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/50" />
                Hozircha yangi bildirishnomalar yo‘q
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readAt;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n.id, !isUnread)}
                    className={cn(
                      'p-2.5 rounded-xl cursor-pointer transition-colors text-xs space-y-1',
                      isUnread
                        ? 'bg-primary/5 hover:bg-primary/10 border-l-2 border-primary'
                        : 'opacity-70 hover:opacity-100 hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        {SEVERE_TYPES.has(n.type) ? (
                          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : WARNING_TYPES.has(n.type) ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                        ) : (
                          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                        <span className="truncate">{n.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{format(parseISO(n.createdAt), 'HH:mm')}</span>
                        {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-primary ml-0.5" />}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed pl-5">
                      {n.body}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
