import { EllipsisVertical, ExternalLink, Pencil, Trash2, Undo2 } from 'lucide-react';
import type { TransactionResponse } from '@fintrack/shared';
import { Menu, type MenuItem } from '../../../components/ui/Menu';
import { Amount } from '../../../components/ui/Amount';
import { cn } from '../../../lib/utils';
import { TxTile, rowKind, rowSubtitle, rowTitle } from '../rowView';

export interface RowActions {
  onEdit: (tx: TransactionResponse) => void;
  onDelete: (tx: TransactionResponse) => void;
  onCancelTransfer: (tx: TransactionResponse) => void;
  onOpenDebt: (tx: TransactionResponse) => void;
}

function itemsFor(tx: TransactionResponse, actions: RowActions): MenuItem[] {
  switch (rowKind(tx)) {
    case 'entry':
      return [
        { label: 'Tahrirlash', icon: Pencil, onSelect: () => actions.onEdit(tx) },
        { label: 'O‘chirish', icon: Trash2, danger: true, separatorBefore: true, onSelect: () => actions.onDelete(tx) },
      ];
    case 'transfer':
      return [{ label: 'O‘tkazmani bekor qilish', icon: Undo2, danger: true, onSelect: () => actions.onCancelTransfer(tx) }];
    case 'debt':
      return [{ label: 'Qarzga o‘tish', icon: ExternalLink, disabled: !tx.debtId, onSelect: () => actions.onOpenDebt(tx) }];
    default:
      return [];
  }
}

/** ⋮ of a row: a popover on desktop, a sheet with the row on top on phones. */
export function TransactionRowMenu({ tx, when, actions, size = 'sm' }: { tx: TransactionResponse; when: string; actions: RowActions; size?: 'sm' | 'md' }) {
  return (
    // The row itself opens on click; nothing in the menu (or its portalled sheet) may reach it.
    <div onClick={(e) => e.stopPropagation()} className="flex">
      <Menu
        label="Amallar"
        items={itemsFor(tx, actions)}
        sheetHeader={
          <div className="flex items-center gap-3">
            <TxTile tx={tx} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{rowTitle(tx)}</span>
              <span className="truncate text-[13px] text-text-muted">{rowSubtitle(tx, when)}</span>
            </div>
            <Amount value={tx.amount} type={tx.type} className="font-semibold" />
          </div>
        }
        trigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label="Amallar"
            className={cn(
              'flex items-center justify-center rounded-full text-text-secondary transition-colors duration-fast hover:bg-secondary hover:text-text focus-ring aria-expanded:bg-secondary',
              size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
            )}
          >
            <EllipsisVertical className="h-4 w-4" aria-hidden />
          </button>
        )}
      />
    </div>
  );
}
