import { Outlet, Navigate } from 'react-router-dom';
import { Moon, Sun, Wallet } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Button } from '../ui/Button';

export function AuthLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const { theme, setTheme } = useUiStore();

  if (isAuthenticated && user) {
    return <Navigate to="/app" replace />;
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-background">
      {/* Background glowing gradients */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />

      {/* Top Navbar with Logo and Theme toggle */}
      <header className="relative z-10 flex w-full items-center justify-between p-6 md:px-12">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-foreground">FinTrack</span>
            <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              UZ
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Mavzuni almashtirish"
          className="rounded-full"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5 text-warning" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
        </Button>
      </header>

      {/* Main Form Center Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FinTrack. Shaxsiy moliya boshqaruvi platformasi.
      </footer>
    </div>
  );
}
