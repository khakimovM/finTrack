import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutGrid, LogOut, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Avatar } from '../ui/Avatar';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { MORE_ITEMS, TAB_ITEMS, type NavItem } from './nav';
import { QuickAddSheet } from './QuickAdd';
import { ModeChip, useInMiniApp, useLogout, userHandle } from './ShellParts';

function Tab({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-md text-[10.5px] leading-[14px] tracking-[-0.01em] focus-ring',
          isActive ? 'font-semibold text-text' : 'font-medium text-text-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.3 : 2} aria-hidden />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function MoreSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const inMiniApp = useInMiniApp();
  const logout = useLogout();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useUiStore();

  return (
    <Sheet isOpen={isOpen} onClose={onClose} aria-label="Ko‘proq">
      {user && (
        <div className="flex items-center gap-3 border-b border-border pb-3.5 pt-2">
          <Avatar name={user.name} size={44} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-[13px] text-text-muted">{userHandle(user)}</span>
          </span>
          <ModeChip strict={user.strictMode} className="self-center" />
        </div>
      )}
      <nav className="flex flex-col py-1" aria-label="Boshqa bo‘limlar">
        {MORE_ITEMS.map((item) => (
          <button
            key={item.to}
            type="button"
            onClick={() => {
              onClose();
              navigate(item.to);
            }}
            className="flex h-[52px] items-center gap-3.5 rounded-md text-left text-[16px] font-medium focus-ring"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-secondary">
              <item.icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="h-[18px] w-[18px] text-text-muted" aria-hidden />
          </button>
        ))}
      </nav>
      {inMiniApp ? (
        <p className="border-t border-border pt-3 text-[12px] leading-4 text-text-muted">Mavzu Telegram sozlamalariga moslashadi.</p>
      ) : (
        <div className="flex flex-col border-t border-border pt-1">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <span className="text-[16px] font-medium">Mavzu</span>
            <Segmented
              aria-label="Mavzu"
              value={resolvedTheme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Yorug‘' },
                { value: 'dark', label: 'Qorong‘i' },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              void logout();
            }}
            className="flex h-[52px] items-center gap-3.5 rounded-md text-left text-[16px] font-medium text-danger focus-ring"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-danger-soft">
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
            </span>
            Chiqish
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Phone bottom bar: two tabs, the "+" circle, Qarzlar and "Ko‘proq"; respects the home indicator. */
export function TabBar() {
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const moreActive = moreOpen || MORE_ITEMS.some((item) => pathname.startsWith(item.to));

  return (
    <>
      <nav
        aria-label="Asosiy menyu"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-1.5 pt-1.5"
        style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))' }}
      >
        <Tab item={TAB_ITEMS[0]} />
        <Tab item={TAB_ITEMS[1]} />
        <div className="flex items-start justify-center">
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            aria-label="Qo‘shish"
            className="-mt-3.5 mb-0.5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--card),var(--shadow-md)] focus-ring"
          >
            <Plus className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <Tab item={TAB_ITEMS[2]} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className={cn(
            'flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-md text-[10.5px] leading-[14px] tracking-[-0.01em] focus-ring',
            moreActive ? 'font-semibold text-text' : 'font-medium text-text-muted',
          )}
        >
          <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={moreActive ? 2.3 : 2} aria-hidden />
          Ko‘proq
        </button>
      </nav>
      <QuickAddSheet isOpen={quickOpen} onClose={() => setQuickOpen(false)} />
      <MoreSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
