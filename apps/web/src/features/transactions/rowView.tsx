import { ArrowLeftRight, Handshake, Lock } from 'lucide-react';
import type { CategoryResponse, TransactionResponse } from '@fintrack/shared';
import { EmojiTile } from '../../components/ui/EmojiTile';
import { TYPE_LABELS } from './typeLabels';

/** income/expense are edited here; transfers and debt rows are owned by their own pages. */
export type RowKind = 'entry' | 'transfer' | 'debt' | 'adjustment';

export function rowKind(tx: TransactionResponse): RowKind {
  switch (tx.type) {
    case 'INCOME':
    case 'EXPENSE':
      return 'entry';
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT':
      return 'transfer';
    case 'ADJUSTMENT':
      return 'adjustment';
    default:
      return 'debt';
  }
}

/** "Humo karta → Jamg‘arma", always from the sender to the receiver. */
export function transferRoute(tx: TransactionResponse): string {
  const peer = tx.transferPeer?.name;
  if (!peer) return TYPE_LABELS[tx.type];
  return tx.type === 'TRANSFER_OUT' ? `${tx.account.name} → ${peer}` : `${peer} → ${tx.account.name}`;
}

/** Child category id → parent name, for the "Taksi / Transport" second line. */
export function parentNames(tree: CategoryResponse[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const parent of tree) for (const child of parent.children ?? []) map.set(child.id, parent.name);
  return map;
}

/** Phone card title. */
export function rowTitle(tx: TransactionResponse): string {
  switch (rowKind(tx)) {
    case 'entry':
      return tx.note || tx.category?.name || TYPE_LABELS[tx.type];
    case 'transfer':
      return transferRoute(tx);
    case 'debt':
      return tx.debt ? `${TYPE_LABELS[tx.type]} — ${tx.debt.personName}` : TYPE_LABELS[tx.type];
    default:
      return 'Tuzatish';
  }
}

/** Phone card second line; `when` is the time, or date and time when not grouped by day. */
export function rowSubtitle(tx: TransactionResponse, when: string): string {
  switch (rowKind(tx)) {
    case 'entry':
      return [tx.category?.name, tx.account.name, when].filter(Boolean).join(' · ');
    case 'transfer':
      return `${TYPE_LABELS[tx.type]} · ${when}`;
    case 'debt':
      return `${tx.account.name} · ${when}`;
    default:
      return `Tizim yozuvi · ${tx.account.name} · ${when}`;
  }
}

/** Desktop "Izoh" column: the route of a transfer, the person of a debt, the note otherwise. */
export function rowNote(tx: TransactionResponse): string {
  const kind = rowKind(tx);
  if (kind === 'transfer') return transferRoute(tx);
  if (kind === 'debt') return tx.debt?.personName ?? tx.note ?? '—';
  return tx.note || '—';
}

export function TxTile({ tx, size = 40 }: { tx: TransactionResponse; size?: 30 | 40 | 48 }) {
  const icon = size === 30 ? 'h-[15px] w-[15px]' : size === 48 ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]';
  switch (rowKind(tx)) {
    case 'transfer':
      return <EmojiTile variant="transfer" size={size} className="text-text-secondary" emoji={<ArrowLeftRight className={icon} />} />;
    case 'debt':
      return <EmojiTile variant="debt" size={size} className="text-debt" emoji={<Handshake className={icon} />} />;
    case 'adjustment':
      return <EmojiTile variant="neutral" size={size} className="text-text-secondary" emoji={<Lock className={icon} />} />;
    default:
      return <EmojiTile emoji={tx.category?.icon ?? (tx.type === 'INCOME' ? '💵' : '🧾')} color={tx.category?.color} size={size} />;
  }
}
