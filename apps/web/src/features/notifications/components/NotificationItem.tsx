import { ChevronRight, Trash2 } from 'lucide-react';
import type { NotificationResponse } from '@fintrack/shared';
import { cn } from '../../../lib/utils';
import { NOTIFICATION_STYLE, notificationTime, TONE_TILE } from '../notificationMeta';

export interface NotificationItemProps {
  notification: NotificationResponse;
  today: string;
  onOpen: (notification: NotificationResponse) => void;
  /** Page variant: link label in the meta row and a delete button. */
  onDelete?: (notification: NotificationResponse) => void;
  variant?: 'compact' | 'page';
}

/** Type icon, title, body, time; unread items are tinted, bold and dotted. */
export function NotificationItem({ notification, today, onOpen, onDelete, variant = 'compact' }: NotificationItemProps) {
  const style = NOTIFICATION_STYLE[notification.type];
  const unread = notification.readAt === null;
  const when = notificationTime(notification.createdAt, today);
  const page = variant === 'page';

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-[14px] transition-colors duration-fast hover:bg-secondary',
        page ? 'px-3 py-3' : 'p-3',
        unread && 'bg-[color-mix(in_oklab,var(--info)_6%,transparent)]',
      )}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', TONE_TILE[style.tone])}>
        <style.icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm text-left focus-ring after:absolute after:inset-0 after:content-['']"
      >
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-[14px] leading-5', unread ? 'font-semibold text-text' : 'font-medium text-text-secondary')}>
            {notification.title}
          </span>
          {unread && page && <span className="h-2 w-2 shrink-0 rounded-full bg-info" aria-label="O‘qilmagan" />}
        </span>
        <span className="text-[13px] leading-[18px] text-text-secondary">{notification.body}</span>
        <span className="flex items-center gap-1 text-[12px] leading-4 text-text-muted">
          {when}
          {page && (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium text-text-secondary">{style.linkLabel}</span>
              <ChevronRight className="h-3 w-3" aria-hidden />
            </>
          )}
        </span>
      </button>
      {unread && !page && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" aria-label="O‘qilmagan" />}
      {page && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(notification)}
          aria-label="O‘chirish"
          className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-fast hover:bg-danger-soft hover:text-danger focus-ring"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
