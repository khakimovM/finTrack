import { useNavigate } from 'react-router-dom';
import { Moon, ShieldAlert, ShieldCheck, Sun } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { useMiniAppStore } from '../../stores/miniAppStore';
import { useUiStore } from '../../stores/uiStore';

/** Inside Telegram: no sign-out (the account is the Telegram account), theme follows Telegram. */
export function useInMiniApp(): boolean {
  return useMiniAppStore((s) => s.status !== 'off');
}

export function useLogout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  return async () => {
    await logout();
    navigate('/', { replace: true });
  };
}

/** "Qatʼiy rejim" (strict: spending above the balance is refused) or "Oddiy rejim". */
export function ModeChip({ strict, className }: { strict: boolean; className?: string }) {
  const Icon = strict ? ShieldAlert : ShieldCheck;
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 self-start rounded-full px-2.5 text-[12px] font-medium',
        strict ? 'bg-warning-soft text-warning' : 'bg-secondary text-text-secondary',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {strict ? 'Qatʼiy rejim' : 'Oddiy rejim'}
    </span>
  );
}

/** 40px bordered circle: moon in light, sun in dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useUiStore();
  const Icon = resolvedTheme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Mavzuni almashtirish"
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-text transition-colors duration-fast hover:bg-secondary focus-ring',
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}

/** "@aziz_k", or the masked phone when there is no username. */
export function userHandle(user: { telegramUsername: string | null; phone: string | null }): string {
  if (user.telegramUsername) return `@${user.telegramUsername}`;
  return user.phone ?? 'Telegram orqali';
}
