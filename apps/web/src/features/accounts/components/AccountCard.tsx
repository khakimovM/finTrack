import type { HTMLAttributes } from 'react';
import { Archive, ArchiveRestore, ChevronRight, EllipsisVertical, GripVertical, Pencil, Star, Trash2 } from 'lucide-react';
import type { AccountResponse } from '@fintrack/shared';
import { Amount } from '../../../components/ui/Amount';
import { EmojiTile } from '../../../components/ui/EmojiTile';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { cn } from '../../../lib/utils';
import { ACCOUNT_TYPES } from '../accountTypes';

export interface AccountActions {
  onOpen: (account: AccountResponse) => void;
  onEdit: (account: AccountResponse) => void;
  onMakeDefault: (account: AccountResponse) => void;
  onArchive: (account: AccountResponse) => void;
  onUnarchive: (account: AccountResponse) => void;
  onDelete: (account: AccountResponse) => void;
}

export interface AccountCardProps {
  account: AccountResponse;
  actions: AccountActions;
  /** Phone: a row of one list instead of a card in a grid. */
  compact: boolean;
  /** Reorder mode: a drag handle instead of the menu; the card does not open. */
  handle?: HTMLAttributes<HTMLSpanElement>;
  dragging?: boolean;
  sortProps?: Record<string, string>;
}

function menuItems(account: AccountResponse, actions: AccountActions): MenuItem[] {
  return [
    { label: 'Tahrirlash', icon: Pencil, onSelect: () => actions.onEdit(account) },
    { label: 'Asosiy qilish', icon: Star, disabled: account.isDefault, onSelect: () => actions.onMakeDefault(account) },
    { label: 'Arxivlash', icon: Archive, onSelect: () => actions.onArchive(account) },
    { label: 'O‘chirish', icon: Trash2, danger: true, separatorBefore: true, onSelect: () => actions.onDelete(account) },
  ];
}

export function AccountCard({ account, actions, compact, handle, dragging, sortProps }: AccountCardProps) {
  const archived = account.archivedAt !== null;
  const reorder = handle !== undefined;
  const type = ACCOUNT_TYPES[account.type].short;
  const count = `Tranzaksiyalar: ${account.transactionCount} ta`;
  const subtitle = compact
    ? [type, account.isDefault && !archived ? '★ Asosiy' : null, archived ? 'Arxivda' : null].filter(Boolean).join(' · ')
    : archived
      ? `${type} · Arxivda`
      : type;
  const open = () => {
    if (!reorder && !archived) actions.onOpen(account);
  };

  const balance = (
    <div className={cn('flex flex-col gap-0.5', compact ? 'items-end' : 'items-start')}>
      {!compact && <span className="text-[13px] text-text-muted">Joriy balans</span>}
      <Amount
        value={account.balance}
        showSign={false}
        unit="muted"
        className={cn(
          'leading-[1.2] tracking-[-0.02em]',
          compact ? 'text-[15px]' : 'text-[24px]',
          archived && BigInt(account.balance) >= 0n && 'text-text-secondary',
        )}
        unitClassName="text-[13px]"
      />
      {compact && <span className="text-[12px] text-text-muted">{count}</span>}
    </div>
  );

  const menu = !archived && !reorder && (
    // The card opens on click; the menu (and its phone sheet, portalled) must not reach it.
    <div onClick={(event) => event.stopPropagation()} className="flex shrink-0">
      <Menu
        label="Amallar"
        width={220}
        items={menuItems(account, actions)}
        trigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label="Amallar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-fast hover:bg-secondary focus-ring aria-expanded:bg-secondary"
          >
            <EllipsisVertical className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      />
    </div>
  );

  return (
    <div
      {...sortProps}
      onClick={open}
      className={cn(
        'relative flex bg-card transition-[box-shadow,transform] duration-fast ease-standard',
        compact
          ? 'flex-row flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-3.5 last:border-b-0'
          : 'flex-col gap-[18px] rounded-[20px] border border-border p-5 hover:shadow-sm',
        !reorder && !archived && 'cursor-pointer',
        archived && 'opacity-75',
        // Lifted off the list while it is carried.
        dragging && 'z-[1] scale-[1.02] shadow-md motion-reduce:scale-100',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {handle && (
          <span {...handle} className="flex w-6 shrink-0 justify-center rounded-sm text-text-muted focus-ring">
            <GripVertical className="h-5 w-5" aria-hidden />
          </span>
        )}
        <EmojiTile emoji={account.icon} color={account.color} size={compact ? 44 : 48} muted={archived} className="rounded-[14px] text-[22px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-[72px] truncate text-[16px] font-semibold leading-[22px]">{account.name}</span>
            {!compact && account.isDefault && !archived && (
              <span className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2 text-[12px] font-semibold text-warning">
                <Star className="h-3 w-3 fill-current" aria-hidden />
                Asosiy
              </span>
            )}
          </span>
          <span className="text-[13px] leading-[18px] text-text-muted">{subtitle}</span>
        </div>
        {compact && balance}
        {menu}
      </div>

      {!compact && balance}

      {!compact && !archived && (
        <div className="flex items-center justify-between border-t border-border pt-3.5 text-[13px] text-text-secondary">
          <span>{count}</span>
          {!reorder && (
            <span className="flex items-center gap-0.5 font-medium text-text">
              Tranzaksiyalar
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
      )}

      {archived && (
        <div className={cn('flex flex-wrap gap-2', compact && 'basis-full pl-14')}>
          <button
            type="button"
            onClick={() => actions.onUnarchive(account)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-input bg-card px-3.5 text-[13px] font-medium text-text hover:bg-secondary focus-ring"
          >
            <ArchiveRestore className="h-4 w-4" aria-hidden />
            Arxivdan chiqarish
          </button>
          <button
            type="button"
            onClick={() => actions.onDelete(account)}
            className="h-9 rounded-full px-3.5 text-[13px] font-medium text-danger hover:bg-danger-soft focus-ring"
          >
            O‘chirish
          </button>
        </div>
      )}
    </div>
  );
}
