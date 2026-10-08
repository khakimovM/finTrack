import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LoginCard } from '../../features/auth/components/LoginCard';
import { TelegramLoginPanel } from '../../features/auth/components/TelegramLoginPanel';
import { useSessionQuery } from '../../features/auth/hooks/useSession';
import { userLoginApi } from '../../features/auth/hooks/useTelegramLogin';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);
  const session = useSessionQuery();
  const [started, setStarted] = useState(false);

  // Already signed in (e.g. "Kirish" on the landing page with a live cookie): go straight in.
  if (session.data && !started) return <Navigate to="/app" replace />;

  return (
    <LoginCard
      title="FinTrack’ga kirish"
      description="Parol shart emas: kirish kodi Telegram’dagi botimizga keladi. Birinchi marta kirsangiz, hisob avtomatik yaratiladi."
    >
      <TelegramLoginPanel
        api={userLoginApi}
        onStarted={() => setStarted(true)}
        onVerified={(user) => {
          signIn(user);
          const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
          navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
        }}
      />
    </LoginCard>
  );
}
