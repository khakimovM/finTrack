import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Skeleton } from '../../components/ui/Skeleton';
import { PageHeader } from '../../components/layout/PageHeader';
import { useInMiniApp, useLogout } from '../../components/layout/ShellParts';
import { useIsMobile } from '../../lib/useMediaQuery';
import {
  AppearanceSection,
  PreferencesSection,
  ProfileSection,
  SettingsCard,
} from '../../features/settings/components/ProfileSection';
import { DangerZoneSection, SessionsSection, TelegramSection } from '../../features/settings/components/SecuritySections';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const inMiniApp = useInMiniApp();
  const isMobile = useIsMobile();
  const logout = useLogout();

  return (
    <div className="mx-auto flex w-full max-w-[824px] flex-col gap-4">
      <PageHeader title="Sozlamalar" subtitle="Profil, qoidalar, ko‘rinish va xavfsizlik" />

      {!user ? (
        <SettingsCard title="Profil">
          <div role="status" aria-label="Yuklanmoqda" className="flex flex-col gap-3">
            <Skeleton className="h-3.5 w-1/5" />
            <Skeleton className="h-12" />
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-12" />
          </div>
        </SettingsCard>
      ) : (
        <>
          <ProfileSection user={user} />
          <PreferencesSection user={user} />
          {/* Inside Telegram the theme follows the Telegram app. */}
          {!inMiniApp && <AppearanceSection />}
          <TelegramSection user={user} />
          <SessionsSection />
          <DangerZoneSection />
          {/* Phones have no sidebar with the sign-out button; Telegram has no sign-out at all. */}
          {isMobile && !inMiniApp && (
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-14 items-center gap-3.5 rounded-[20px] border border-border bg-card px-4 text-[16px] font-medium text-danger focus-ring"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-danger-soft" aria-hidden>
                <LogOut className="h-[18px] w-[18px]" />
              </span>
              Chiqish
            </button>
          )}
        </>
      )}
    </div>
  );
}
