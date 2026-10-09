import { AdminUserRow } from '@fintrack/shared';
import { Avatar } from '../../../components/ui/Avatar';
import { cn } from '../../../lib/utils';
import { formatCount } from '../format';
import { UserStatusChips, channelsText, formatJoined, formatSeen } from './UserBits';

const TABLE_COLS =
  'grid-cols-[minmax(0,1.7fr)_128px_132px_132px_76px_68px_minmax(0,1fr)]';

interface UserListProps {
  users: AdminUserRow[];
  today: string;
  variant: 'table' | 'cards';
  onOpen: (id: string) => void;
}

function Who({ user }: { user: AdminUserRow }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={user.name} size={36} />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[14px] font-medium">{user.name}</span>
        </span>
        <span className="truncate text-[13px] text-text-muted">{user.telegramUsername ? `@${user.telegramUsername}` : 'username yo‘q'}</span>
      </span>
    </span>
  );
}

/**
 * People in the panel: a table from 1024px, cards below (phones and tablets). A row opens the
 * person's card; only activity is shown, never money.
 */
export function UserList({ users, today, variant, onOpen }: UserListProps) {
  if (variant === 'cards') {
    return (
      <ul className="ft-stagger flex flex-col gap-2.5">
        {users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onClick={() => onOpen(user.id)}
              className="flex w-full flex-col gap-2.5 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-fast hover:bg-surface focus-ring"
            >
              <span className="flex w-full items-start justify-between gap-3">
                <Who user={user} />
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  <UserStatusChips user={user} />
                </span>
              </span>
              <span className="text-[13px] leading-5 text-text-secondary">
                {formatCount(user.entries)} yozuv · {formatCount(user.accounts)} hisob · {channelsText(user.channels)}
              </span>
              <span className="text-[12.5px] leading-[18px] text-text-muted">
                Ro‘yxatdan: {formatJoined(user.createdAt)} · Oxirgi: {formatSeen(user.lastSeenAt, today)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div role="table" aria-label="Foydalanuvchilar" className="flex flex-col">
      <div role="row" className={cn('grid h-11 items-center gap-3 border-b border-border px-4 text-[12px] font-medium text-text-muted', TABLE_COLS)}>
        <span role="columnheader">Foydalanuvchi</span>
        <span role="columnheader">Telefon</span>
        <span role="columnheader">Ro‘yxatdan o‘tgan</span>
        <span role="columnheader">Oxirgi faollik</span>
        <span role="columnheader" className="text-right">
          Yozuvlar
        </span>
        <span role="columnheader" className="text-right">
          Hisoblar
        </span>
        <span role="columnheader">Kanallar · holat</span>
      </div>
      <div className="ft-stagger">
        {users.map((user) => (
          <div
            key={user.id}
            role="row"
            tabIndex={0}
            onClick={() => onOpen(user.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(user.id);
              }
            }}
            className={cn(
              'grid h-[58px] cursor-pointer items-center gap-3 border-b border-border px-4 text-[14px] transition-colors duration-fast last:border-b-0 hover:bg-surface focus-ring',
              TABLE_COLS,
            )}
          >
            <span role="cell" className="min-w-0">
              <Who user={user} />
            </span>
            <span role="cell" className="truncate text-text-secondary tabular-nums">
              {user.phone ?? '—'}
            </span>
            <span role="cell" className="truncate text-text-secondary">
              {formatJoined(user.createdAt)}
            </span>
            <span role="cell" className="truncate text-text-secondary">
              {formatSeen(user.lastSeenAt, today)}
            </span>
            <span role="cell" className="text-right font-medium tabular-nums">
              {formatCount(user.entries)}
            </span>
            <span role="cell" className="text-right tabular-nums text-text-secondary">
              {formatCount(user.accounts)}
            </span>
            <span role="cell" className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="mr-1 truncate text-[13px] text-text-secondary">{channelsText(user.channels)}</span>
              <UserStatusChips user={user} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
