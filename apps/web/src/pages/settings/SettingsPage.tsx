import { useAuthStore } from '../../stores/authStore';
import { Skeleton } from '../../components/ui/Skeleton';
import { PreferencesSection, ProfileSection } from '../../features/settings/components/ProfileSection';
import {
  DangerZoneSection,
  SessionsSection,
  TelegramSection,
} from '../../features/settings/components/SecuritySections';
import { PageHeader } from '../../components/layout/PageHeader';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Sozlamalar" subtitle="Profil, qoidalar, ko‘rinish va xavfsizlik" />

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
