import { useEffect, useRef } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChartPie, LayoutGrid, LogOut, ScrollText, Server, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { Logo } from '../../../components/brand/Logo';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ThemeToggle } from '../../../components/layout/ShellParts';
import { queryKeys } from '../../../lib/queryKeys';
import { cn } from '../../../lib/utils';
import { NotFoundPage } from '../../../pages/NotFoundPage';
import { MiniAppSplash } from '../../miniapp/MiniAppSplash';
import { useAdminLogout, useAdminSession } from '../hooks/useAdminSession';
import { isAdminSessionGone } from '../hooks/useAdminData';

const NAV: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/admin', label: 'Umumiy', icon: LayoutGrid, end: true },
  { to: '/admin/users', label: 'Foydalanuvchilar', icon: Users },
  { to: '/admin/growth', label: 'O‘sish', icon: TrendingUp },
  { to: '/admin/usage', label: 'Foydalanish', icon: ChartPie },
  { to: '/admin/system', label: 'Tizim', icon: Server },
  { to: '/admin/audit', label: 'Audit', icon: ScrollText },
];

/** Set while this tab has an admin session, so an ended one leads back to sign-in instead of 404. */
const SIGNED_IN_KEY = 'ft-admin-signed-in';

function rememberSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) sessionStorage.setItem(SIGNED_IN_KEY, '1');
    else sessionStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // Storage can be blocked; a visitor then just sees the 404 page.
  }
}

function wasSignedIn(): boolean {
  try {
    return sessionStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The admin area's frame and gate. Without an admin session /admin looks like any unknown page
 * (404), the same as the API; the owner signs in at /admin/login. A session that ends while the
 * panel is open (8 hours, or an hour idle) leads back to sign-in.
 */
export function AdminShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAdminSession();
  const logout = useAdminLogout();
  const signedIn = Boolean(session.data);
  const settled = !session.isPending && !session.isError;
  // Read once per mount (render stays pure); a session seen during this visit counts too.
  const hadSession = useRef(wasSignedIn());
  if (signedIn) hadSession.current = true;

  useEffect(() => {
    if (settled) rememberSignedIn(signedIn);
  }, [settled, signedIn]);

  // Any admin request answered 404 means the session is gone: ask once more, the gate does the rest.
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        const [scope, part] = event.query.queryKey as unknown[];
        if (event.type !== 'updated' || event.action.type !== 'error' || scope !== 'admin' || part === 'session') return;
        if (isAdminSessionGone(event.action.error)) void queryClient.invalidateQueries({ queryKey: queryKeys.admin.session() });
      }),
    [queryClient],
  );

  if (session.isPending) return <MiniAppSplash />;
  if (session.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <ErrorState onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (!session.data) return hadSession.current ? <Navigate to="/admin/login" replace /> : <NotFoundPage />;

  const signOut = async () => {
    rememberSignedIn(false);
    await logout.mutateAsync().catch(() => undefined);
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_oklab,var(--background)_86%,transparent)] backdrop-blur-[14px]">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:h-16 sm:px-6 xl:px-8">
          <Logo size={28} />
          <Chip tone="info" className="font-semibold">
            Admin
          </Chip>
          <span className="ml-auto hidden truncate text-[14px] text-text-secondary sm:block">{session.data.admin.name}</span>
          <ThemeToggle className="ml-auto sm:ml-0" />
          <Button variant="outline" size="sm" onClick={() => void signOut()} loading={logout.isPending}>
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Chiqish</span>
          </Button>
        </div>
        <nav aria-label="Admin bo‘limlari" className="mx-auto max-w-[1440px] overflow-x-auto px-2.5 sm:px-4 xl:px-6">
          <ul className="flex w-max gap-1 pb-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium transition-colors duration-fast focus-ring',
                      isActive ? 'bg-secondary text-text' : 'text-text-secondary hover:bg-secondary hover:text-text',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto flex max-w-[1440px] animate-ft-page-in flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
        <Outlet />
      </main>
    </div>
  );
}

/** The page's one h1 with its subtitle and, on the right, its controls. */
export function AdminPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] sm:text-[28px] sm:leading-9">{title}</h1>
        {subtitle && <p className="text-[14px] leading-5 text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** An unknown /admin/… address for a signed-in admin: stay inside the panel. */
export function AdminNotFound() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <EmptyState
        title="Bunday bo‘lim yo‘q"
        description="Manzil noto‘g‘ri yoki bo‘lim olib tashlangan."
        action={
          <Link to="/admin" className="text-[14px] font-medium underline decoration-input underline-offset-[3px] hover:decoration-text">
            Umumiy ko‘rinishga qaytish
          </Link>
        }
      />
    </div>
  );
}
