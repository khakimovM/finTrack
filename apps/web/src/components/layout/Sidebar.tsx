import { NavLink } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { LogoMark } from '../brand/Logo';
import { Avatar } from '../ui/Avatar';
import { CountBadge } from '../ui/Chip';
import { useNotifications } from '../../features/notifications/hooks/useNotifications';
import { NAV_GROUPS } from './nav';
import { ModeChip, useInMiniApp, useLogout, userHandle } from './ShellParts';

interface SidebarProps {
  mode: 'full' | 'rail';
  onToggle: () => void;
}

/** Text that only the full panel shows: unbroken while the panel widens, fading in after it. */
const label = 'whitespace-nowrap animate-ft-fade-in';

/** 268px panel (desktop) or 84px icon rail (tablet); the user's card sits at the bottom. */
export function Sidebar({ mode, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const inMiniApp = useInMiniApp();
  const logout = useLogout();
  const { data: notifications } = useNotifications();
  const unread = notifications?.meta.unreadCount ?? 0;
  const rail = mode === 'rail';

  return (
    // The width eases between rail and panel; the labels fade in once there is room for them.
    <aside
      className={cn(
        'shrink-0 py-3 pl-3 transition-[width] duration-slow ease-standard motion-reduce:transition-none',
        rail ? 'w-[84px]' : 'w-[268px]',
      )}
      aria-label="Asosiy menyu"
    >
      <div
        className={cn(
          'sticky top-3 flex h-[calc(100vh-24px)] flex-col overflow-hidden rounded-xl border border-border bg-card',
          rail ? 'items-center px-2 pb-2 pt-3' : 'px-3 pb-2.5 pt-3',
        )}
      >
        <div className={cn('flex items-center', rail ? 'flex-col gap-2.5 pb-3' : 'gap-2.5 pb-2.5 pl-2 pr-1')}>
          <LogoMark size={rail ? 30 : 28} />
          {!rail && <span className={cn('flex-1 text-[18px] font-semibold tracking-[-0.02em]', label)}>FinTrack</span>}
          <button
            type="button"
            onClick={onToggle}
            aria-label={rail ? 'Menyuni yoyish' : 'Menyuni yig‘ish'}
            className={cn(
              'flex items-center justify-center text-text-muted transition-colors duration-fast hover:bg-secondary hover:text-text focus-ring',
              rail ? 'h-9 w-11 rounded-[10px]' : 'h-8 w-8 rounded-[9px]',
            )}
          >
            {rail ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />}
          </button>
        </div>

        {/* Sized to fit a 768px laptop screen whole; it scrolls only on shorter windows. */}
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto scrollbar-none">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label ?? index} className="flex flex-col gap-0.5">
              {group.label && !rail && (
                <span className={cn('px-3 pb-1 text-[12px] font-medium leading-4 text-text-muted', label)}>{group.label}</span>
              )}
              {group.items.map((item) => {
                const badge = item.badge === 'notifications' ? unread : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    title={rail ? item.label : undefined}
                    aria-label={rail ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center rounded-md text-[14px] transition-colors duration-fast focus-ring',
                        rail ? 'h-10 w-12 justify-center' : 'h-9 gap-3 px-3',
                        isActive
                          ? 'bg-secondary font-semibold text-text'
                          : 'font-medium text-text-secondary hover:bg-secondary hover:text-text',
                      )
                    }
                  >
                    <item.icon className={rail ? 'h-5 w-5' : 'h-[18px] w-[18px]'} aria-hidden />
                    {!rail && <span className={cn('flex-1 truncate', label)}>{item.label}</span>}
                    {badge > 0 &&
                      (rail ? (
                        <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-danger shadow-[0_0_0_2px_var(--card)]" aria-hidden />
                      ) : (
                        <CountBadge count={badge} />
                      ))}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {user &&
          (rail ? (
            <div className="mt-2 flex flex-col items-center gap-1.5 pt-1.5">
              <span className="relative" title={user.name}>
                <Avatar name={user.name} size={36} />
                <span
                  className={cn(
                    'absolute -bottom-[3px] -right-[3px] h-[18px] w-[18px] rounded-full shadow-[0_0_0_2px_var(--card)]',
                    user.strictMode ? 'bg-warning' : 'bg-input',
                  )}
                  aria-label={user.strictMode ? 'Qatʼiy rejim' : 'Oddiy rejim'}
                />
              </span>
              {!inMiniApp && (
                <button
                  type="button"
                  onClick={() => void logout()}
                  aria-label="Chiqish"
                  className="flex h-9 w-11 items-center justify-center rounded-[10px] text-text-secondary hover:bg-danger-soft hover:text-danger focus-ring"
                >
                  <LogOut className="h-[18px] w-[18px]" aria-hidden />
                </button>
              )}
            </div>
          ) : (
            <div className={cn('mt-2 flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5', label)}>
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size={36} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold leading-5">{user.name}</span>
                  <span className="truncate text-[12px] leading-4 text-text-muted">{userHandle(user)}</span>
                </span>
                {!inMiniApp && (
                  <button
                    type="button"
                    onClick={() => void logout()}
                    aria-label="Chiqish"
                    title="Chiqish"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-danger-soft hover:text-danger focus-ring"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              <ModeChip strict={user.strictMode} />
            </div>
          ))}
      </div>
    </aside>
  );
}
