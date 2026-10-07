import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../lib/useMediaQuery';
import { EXIT_MS, popMotion, usePresence } from '../../lib/motion';
import { useDismiss } from './Popover';
import { Sheet } from './Sheet';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  /** Custom leading element instead of an icon (e.g. a "CSV" tile). */
  lead?: React.ReactNode;
  onSelect: () => void;
  /** Red, and placed last after a separator by convention. */
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  /** Muted second line in the phone sheet. */
  hint?: string;
}

export interface MenuTriggerProps {
  ref: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
}

export interface MenuProps {
  trigger: (props: MenuTriggerProps) => React.ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  /** Popover width (240 row menus, 200 debt, 220 account). */
  width?: number;
  /** Phones get a bottom sheet; this goes above the actions (e.g. the row being acted on). */
  sheetHeader?: React.ReactNode;
  sheetTitle?: string;
  /** A muted line above the items, in the popover and the sheet (the range an export covers). */
  header?: React.ReactNode;
  label: string;
  className?: string;
}

/** Popover of actions from 640px, a bottom sheet on phones. */
export function Menu({ trigger, items, align = 'end', width = 240, sheetHeader, sheetTitle, header, label, className }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const close = React.useCallback(() => setOpen(false), []);
  useDismiss([rootRef], open && !isMobile, close);
  const popover = usePresence(open && !isMobile, EXIT_MS.base);

  React.useEffect(() => {
    if (open && !isMobile) itemRefs.current.find((node) => node && !node.disabled)?.focus();
  }, [open, isMobile]);

  const select = (item: MenuItem) => {
    if (item.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    item.onSelect();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const enabled = itemRefs.current.filter((node): node is HTMLButtonElement => Boolean(node && !node.disabled));
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      enabled[(index + step + enabled.length) % enabled.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const triggerNode = trigger({
    ref: triggerRef,
    onClick: () => setOpen((value) => !value),
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  });

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      {triggerNode}
      {popover.mounted && (
        <div
          role="menu"
          aria-label={label}
          aria-hidden={popover.closing || undefined}
          onKeyDown={onKeyDown}
          style={{ width }}
          className={cn(
            'absolute top-full z-40 mt-1.5 rounded-lg border border-border bg-popover p-1.5 shadow-md',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            popMotion(popover.closing),
          )}
        >
          {header && <div className="px-2.5 pb-1 pt-2 text-[12px] text-text-muted">{header}</div>}
          {items.map((item, index) => (
            <React.Fragment key={item.label}>
              {item.separatorBefore && <div role="separator" className="mx-0 my-1 h-px bg-border" />}
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => select(item)}
                className={cn(
                  'flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[14px] font-medium outline-none transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40',
                  item.danger ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft' : 'text-text hover:bg-secondary focus-visible:bg-secondary',
                )}
              >
                {item.lead}
                {item.icon && <item.icon className="h-4 w-4 shrink-0" aria-hidden />}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
      {isMobile && (
        <Sheet isOpen={open} onClose={close} title={sheetTitle} aria-label={label}>
          {sheetHeader && <div className="mb-2 border-b border-border pb-3">{sheetHeader}</div>}
          <div role="menu" aria-label={label} className="flex flex-col">
            {header && <div className="pb-1 text-[13px] text-text-muted">{header}</div>}
            {items.map((item) => (
              <React.Fragment key={item.label}>
                {item.separatorBefore && <div role="separator" className="my-1 h-px bg-border" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => select(item)}
                  className={cn(
                    'flex min-h-[52px] w-full items-center gap-3.5 rounded-md px-1 text-left text-[16px] font-medium disabled:opacity-40',
                    item.danger ? 'text-danger' : 'text-text',
                  )}
                >
                  {item.lead}
                  {item.icon && (
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
                        item.danger ? 'bg-danger-soft' : 'bg-secondary',
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                  )}
                  <span className="flex flex-col">
                    {item.label}
                    {item.hint && <span className="text-[13px] font-normal text-text-muted">{item.hint}</span>}
                  </span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
