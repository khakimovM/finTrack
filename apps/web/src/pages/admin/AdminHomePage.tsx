import { ChartColumn } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAdminSession } from '../../features/admin/hooks/useAdminSession';
import { formatDateTime } from '../../lib/format';

/** Admin home. Statistics, users and system pages arrive in J3–J5 (docs/09-ADMIN-PANEL.md). */
export function AdminHomePage() {
  const session = useAdminSession();
  const expiresAt = session.data?.expiresAt;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.02em]">Admin panel</h1>
        {expiresAt && (
          <p className="text-[14px] text-text-secondary">
            Sessiya {formatDateTime(expiresAt)} gacha amal qiladi, 1 soat harakatsizlikda esa tugaydi.
          </p>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={<ChartColumn className="h-6 w-6" aria-hidden />}
          title="Statistika tez orada shu yerda bo‘ladi"
          description="Foydalanuvchilar, o‘sish, faollik va tizim holati keyingi bosqichlarda qo‘shiladi."
        />
      </div>
    </>
  );
}
