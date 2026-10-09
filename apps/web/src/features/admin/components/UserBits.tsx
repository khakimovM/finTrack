import { AdminChannel, AdminUserRow, todayLocalIso } from '@fintrack/shared';
import { Chip } from '../../../components/ui/Chip';
import { formatDate, formatRelativeDay, formatTime } from '../../../lib/format';
import { CHANNEL_LABELS } from '../format';

/** "Bugun, 14:05", "Kecha, 09:12", "3-okt, 18:40", or a dash when never seen. */
export function formatSeen(iso: string | null, today: string): string {
  if (!iso) return '—';
  return `${formatRelativeDay(todayLocalIso(new Date(iso)), today)}, ${formatTime(iso)}`;
}

/** The day an account was created, in the viewer's (Tashkent) calendar. */
export function formatJoined(iso: string): string {
  return formatDate(todayLocalIso(new Date(iso)));
}

export function channelsText(channels: AdminChannel[]): string {
  return channels.length > 0 ? channels.map((c) => CHANNEL_LABELS[c]).join(', ') : 'Faol emas';
}

/** Status chips: banned and deleted first, "blocked the bot" beside them; nothing for the ordinary case. */
export function UserStatusChips({ user, isAdmin }: { user: Pick<AdminUserRow, 'status' | 'botBlocked'>; isAdmin?: boolean }) {
  return (
    <>
      {isAdmin && (
        <Chip tone="info" size="sm" className="font-semibold">
          Admin
        </Chip>
      )}
      {user.status === 'banned' && (
        <Chip tone="danger" size="sm" dot>
          Bloklangan
        </Chip>
      )}
      {user.status === 'deleted' && (
        <Chip tone="neutral" size="sm" dot>
          O‘chirilgan
        </Chip>
      )}
      {user.botBlocked && user.status !== 'deleted' && (
        <Chip tone="warning" size="sm">
          Botni bloklagan
        </Chip>
      )}
    </>
  );
}
