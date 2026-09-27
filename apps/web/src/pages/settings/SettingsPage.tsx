import { Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Skeleton } from '../../components/ui/Skeleton';
import { PreferencesSection, ProfileSection } from '../../features/settings/components/ProfileSection';
import {
  DangerZoneSection,
  SessionsSection,
  TelegramSection,
} from '../../features/settings/components/SecuritySections';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold tracking-tight">Sozlamalar</h1>
      </div>

      {!user ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <ProfileSection user={user} />
          <PreferencesSection user={user} />
          <TelegramSection user={user} />
          <SessionsSection />
          <DangerZoneSection />
        </>
      )}
    </div>
  );
}
