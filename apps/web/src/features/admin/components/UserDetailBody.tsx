import { AdminUserDetail } from '@fintrack/shared';
import { ShieldAlert } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { BarList } from '../../../components/charts/BarList';
import { formatDateTime } from '../../../lib/format';
import { formatCount, percentOf } from '../format';
import { SOURCES } from '../labels';
import { ActivityCalendar } from './ActivityCalendar';
import { UserStatusChips, channelsText, formatJoined, formatSeen } from './UserBits';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[12.5px] text-text-muted">{label}</dt>
      <dd className="truncate text-[14px] font-medium">{value}</dd>
    </div>
  );
}

/** What the panel knows about one person: who, how active, where their entries come from. */
export function UserDetailBody({ detail, today }: { detail: AdminUserDetail; today: string }) {
  const { user, counts, entriesBySource } = detail;
  const sourceTotal = SOURCES.reduce((sum, s) => sum + entriesBySource[s.key], 0);

  return (
    <div className="flex flex-col gap-5 pb-1">
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} size={56} letters={2} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[18px] font-semibold leading-6">{user.name}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-[14px] text-text-secondary">
            {user.telegramUsername ? `@${user.telegramUsername}` : 'username yo‘q'}
            <UserStatusChips user={user} isAdmin={user.isAdmin} />
          </span>
        </div>
      </div>

      {user.status === 'banned' && (
        <div className="flex gap-3 rounded-[14px] bg-danger-soft p-3.5 text-[14px] leading-5 text-text">
          <ShieldAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-danger" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold">{user.bannedAt ? `${formatDateTime(user.bannedAt)} da bloklangan` : 'Bloklangan'}</span>
            <span className="break-words text-text-secondary">Sabab: {user.banReason ?? '—'}</span>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label="Telefon" value={user.phone ?? '—'} />
        <Fact label="Ro‘yxatdan o‘tgan" value={formatJoined(user.createdAt)} />
        <Fact label="Oxirgi faollik" value={formatSeen(user.lastSeenAt, today)} />
        <Fact label="Kanallar, 30 kun" value={channelsText(user.channels)} />
      </dl>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['Yozuvlar', counts.entries],
            ['Hisoblar', counts.accounts],
            ['O‘z kategoriyalari', counts.categories],
            ['Qarzlar', counts.debts],
            ['Byudjetlar', counts.budgets],
            ['Takroriy to‘lovlar', counts.recurring],
            ['Teglar', counts.tags],
            ['Ochiq sessiyalar', counts.activeSessions],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-[14px] bg-surface px-3 py-2.5">
            <dt className="truncate text-[12.5px] text-text-muted">{label}</dt>
            <dd className="text-[18px] font-semibold leading-6 tabular-nums">{formatCount(value)}</dd>
          </div>
        ))}
      </dl>

      <ActivityCalendar activity={detail.activity} today={today} />

      <div className="flex flex-col gap-2.5">
        <h3 className="text-[14px] font-semibold">Yozuvlar qayerdan</h3>
        {sourceTotal > 0 ? (
          <BarList
            items={SOURCES.filter((s) => entriesBySource[s.key] > 0).map((s) => ({
              key: s.key,
              label: s.label,
              value: entriesBySource[s.key],
              color: s.color,
              display: `${formatCount(entriesBySource[s.key])} · ${percentOf(entriesBySource[s.key], sourceTotal)}%`,
            }))}
          />
        ) : (
          <p className="text-[14px] text-text-secondary">Hali yozuv yo‘q.</p>
        )}
      </div>
    </div>
  );
}
