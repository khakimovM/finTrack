import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useIsMobile, useMediaQuery } from '../../lib/useMediaQuery';
import { useUiStore } from '../../stores/uiStore';
import { useTelegramBackButton } from '../../features/miniapp/useTelegramBackButton';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { GlobalForms } from './GlobalForms';

/**
 * The signed-in frame. ≥1200px: full sidebar; 640–1199px: icon rail (either can be switched);
 * phones: top bar per page plus a bottom tab bar. Pages render their own PageHeader first.
 */
export function AppShell() {
  const isMobile = useIsMobile();
  const isDesktop = useMediaQuery('(min-width: 1200px)');
  const { sidebarMode, setSidebarMode } = useUiStore();
  const mode = sidebarMode ?? (isDesktop ? 'full' : 'rail');
  const { pathname } = useLocation();
  useTelegramBackButton();

  // Toasts sit above the tab bar on phones.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--toast-bottom', isMobile ? '92px' : '24px');
    return () => {
      root.style.removeProperty('--toast-bottom');
    };
  }, [isMobile]);

  return (
    <div className="flex min-h-screen bg-background text-text">
      {!isMobile && <Sidebar mode={mode} onToggle={() => setSidebarMode(mode === 'full' ? 'rail' : 'full')} />}
      <main
        className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col px-4 pt-1 sm:px-6 sm:pb-10 xl:px-8 xl:pb-12"
        style={isMobile ? { paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        {/* Keyed by path: each page fades up as it opens; query changes (filters, tabs) do not replay it. */}
        <div key={pathname} className="flex min-w-0 flex-1 animate-ft-page-in flex-col gap-3 sm:gap-4">
          <Outlet />
        </div>
      </main>
      {isMobile && <TabBar />}
      <GlobalForms />
    </div>
  );
}
