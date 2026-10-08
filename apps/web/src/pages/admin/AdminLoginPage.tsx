import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Chip } from '../../components/ui/Chip';
import { LoginCard } from '../../features/auth/components/LoginCard';
import { TelegramLoginPanel } from '../../features/auth/components/TelegramLoginPanel';
import { adminLoginApi } from '../../features/admin/api/adminAuth.api';
import { useAdminSession } from '../../features/admin/hooks/useAdminSession';
import { queryKeys } from '../../lib/queryKeys';

/** Admin sign-in: the same Telegram code flow, with the bot's separate admin code. */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAdminSession();
  const [started, setStarted] = useState(false);

  if (session.data && !started) return <Navigate to="/admin" replace />;

  return (
    <LoginCard
      title="Admin panel"
      description="Faqat ruxsat berilgan Telegram hisobi kira oladi. Bot sizga alohida, “🛡 admin panel” deb belgilangan kod yuboradi."
      badge={
        <Chip tone="info" className="font-semibold">
          Admin
        </Chip>
      }
    >
      <TelegramLoginPanel
        api={adminLoginApi}
        startLabel="Telegram orqali admin sifatida kirish"
        onStarted={() => setStarted(true)}
        onVerified={(adminSession) => {
          queryClient.setQueryData(queryKeys.admin.session(), adminSession);
          navigate('/admin', { replace: true });
        }}
      />
    </LoginCard>
  );
}
