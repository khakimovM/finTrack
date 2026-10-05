import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../lib/useMediaQuery';
import { Button } from '../ui/Button';
import { Popover } from '../ui/Popover';
import { NotificationBell } from '../../features/notifications/components/NotificationBell';
import { QuickAddGrid } from './QuickAdd';
import { ThemeToggle, useInMiniApp } from './ShellParts';

export interface PageHeaderProps {
  /** The page's one h1. */
  title: string;
  subtitle?: ReactNode;
  /** Desktop: buttons right of the title. */
  actions?: ReactNode;
  /** Phones: the main buttons, shown under the top bar (a grid of one or two). */
  mobileActions?: ReactNode;
  /** equal: same-width buttons; lead: the first fits its text and the last takes the rest. */
  mobileActionsLayout?: 'equal' | 'lead';
  /** Phones: one icon button in the top bar (e.g. export). */
  mobileIcon?: ReactNode;
  /** Adds the global "+ Qo‘shish" with the quick-add popover (home and notifications). */
  quickAdd?: boolean;
  /** Phones outside Telegram: a back arrow to this route (Telegram has its own Back). */
  backTo?: string;
}

/**
 * Desktop: sticky, blurred bar with title and subtitle left, page actions, the bell and the theme
 * toggle right. Phones: a compact 56px bar (title + bell); subtitle and actions open the content.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  mobileActions,
  mobileActionsLayout = 'equal',
  mobileIcon,
  quickAdd,
  backTo,
}: PageHeaderProps) {
  const isMobile = useIsMobile();
  const inMiniApp = useInMiniApp();
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <header
          className="sticky top-0 z-30 -mx-4 flex h-14 items-center gap-1 bg-[color-mix(in_oklab,var(--background)_90%,transparent)] pl-4 pr-1.5 backdrop-blur-[14px]"
          style={{ top: 'env(safe-area-inset-top, 0px)' }}
        >
          {backTo && !inMiniApp && (
            <button
              type="button"
              onClick={() => navigate(backTo)}
              aria-label="Orqaga"
              className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary focus-ring"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
          <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-7 tracking-[-0.01em]">{title}</h1>
          {mobileIcon}
          <NotificationBell compact />
        </header>
        {(subtitle || mobileActions) && (
          <div className="flex flex-col gap-3 pb-1">
            {subtitle && <p className="-mt-1 text-[15px] leading-[22px] text-text-secondary">{subtitle}</p>}
            {mobileActions && (
              <div
                className={cn(
                  'grid gap-2 [&>*]:h-11',
                  mobileActionsLayout === 'lead' ? 'grid-cols-[auto_minmax(0,1fr)]' : 'auto-cols-fr grid-flow-col',
                )}
              >
                {mobileActions}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <header className="sticky top-0 z-30 -mx-6 flex flex-wrap items-center gap-x-6 gap-y-2.5 bg-[color-mix(in_oklab,var(--background)_88%,transparent)] px-6 pb-3.5 pt-[18px] backdrop-blur-[14px] xl:-mx-8 xl:px-8">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="truncate text-[28px] font-semibold leading-9 tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="text-[14px] leading-5 text-text-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {quickAdd && (
          <Popover
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            align="end"
            label="Qo‘shish"
            panelClassName="w-[380px] p-2.5"
            trigger={
              <Button onClick={() => setQuickOpen((v) => !v)} aria-expanded={quickOpen} className="pl-3.5">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden />
                Qo‘shish
              </Button>
            }
          >
            <QuickAddGrid onChosen={() => setQuickOpen(false)} />
          </Popover>
        )}
        <span className={cn('flex items-center gap-2', (actions || quickAdd) && 'ml-1')}>
          <NotificationBell />
          {!inMiniApp && <ThemeToggle />}
        </span>
      </div>
    </header>
  );
}
