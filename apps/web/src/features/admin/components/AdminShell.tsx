import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Logo } from '../../../components/brand/Logo';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { ErrorState } from '../../../components/ui/ErrorState';
import { MiniAppSplash } from '../../miniapp/MiniAppSplash';
import { useAdminLogout, useAdminSession } from '../hooks/useAdminSession';

/**
 * The admin area's frame and gate: without an admin session every /admin page sends you to
 * the admin sign-in. Its own bar, apart from the user app; the sections come in J5.
 */
export function AdminShell() {
  const navigate = useNavigate();
  const session = useAdminSession();
  const logout = useAdminLogout();

  if (session.isPending) return <MiniAppSplash />;
  if (session.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <ErrorState onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (!session.data) return <Navigate to="/admin/login" replace />;

  const signOut = async () => {
    await logout.mutateAsync().catch(() => undefined);
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_oklab,var(--background)_86%,transparent)] backdrop-blur-[14px]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 xl:px-8">
          <Logo size={28} />
          <Chip tone="info" className="font-semibold">
            Admin
          </Chip>
          <span className="ml-auto hidden truncate text-[14px] text-text-secondary sm:block">{session.data.admin.name}</span>
          <Button variant="outline" size="sm" onClick={() => void signOut()} loading={logout.isPending}>
            <LogOut className="h-4 w-4" aria-hidden />
            Chiqish
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1440px] animate-ft-page-in flex-col gap-4 px-4 py-6 sm:px-6 xl:px-8">
        <Outlet />
      </main>
    </div>
  );
}
