import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  HandCoins,
  PiggyBank,
  FolderTree,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Wallet,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { NotificationBell } from '../../features/notifications/components/NotificationBell';

const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Tranzaksiyalar', icon: Receipt },
  { to: '/app/accounts', label: 'Hisoblar', icon: CreditCard },
  { to: '/app/debts', label: 'Qarzlar', icon: HandCoins },
  { to: '/app/budgets', label: 'Byudjetlar', icon: PiggyBank },
  { to: '/app/categories', label: 'Kategoriyalar', icon: FolderTree },
  { to: '/app/reports', label: 'Hisobotlar', icon: BarChart3 },
  { to: '/app/settings', label: 'Sozlamalar', icon: Settings },
];

export function RootLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, setTheme, sidebarOpen, toggleSidebar, setSidebarOpen } = useUiStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-border bg-surface px-4 py-6 transition-transform duration-300 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="space-y-6">
          {/* Logo & Close button */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-xl font-black tracking-tight">FinTrack</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={toggleSidebar}
              aria-label="Menyuni yopish"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center space-x-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',

                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 pt-1">
            <Badge variant={user?.strictMode ? 'warning' : 'secondary'} className="text-[11px] gap-1">
              {user?.strictMode ? (
                <>
                  <ShieldAlert className="h-3 w-3" /> Qatʼiy rejim
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3 w-3" /> Oddiy rejim
                </>
              )}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
              title="Tizimdan chiqish"
              aria-label="Chiqish"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:px-8">
          <div className="flex items-center space-x-3 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Menyuni ochish"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="font-extrabold text-foreground">FinTrack</span>
            </div>
          </div>

          <div className="hidden md:block">
            <h1 className="text-sm font-medium text-muted-foreground">
              Xush kelibsiz, <span className="font-bold text-foreground">{user?.name}</span>!
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
              aria-label="Mavzuni almashtirish"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-warning" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
