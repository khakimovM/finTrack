import { ExternalLink, Info, Undo2 } from 'lucide-react';
import type { TransactionResponse } from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { formatAmount, TONE_CLASS, toneOf } from '../../../lib/money';
import { formatDate, formatTime } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { typeLabel } from '../typeLabels';
import { TxTile, rowKind, transferRoute } from '../rowView';
import { t } from '../../../lib/i18n';

export interface TransactionInfoModalProps {
  transaction: TransactionResponse | null;
  onClose: () => void;
  onCancelTransfer: (tx: TransactionResponse) => void;
  onOpenDebt: (tx: TransactionResponse) => void;
}

/** Read-only card for rows owned elsewhere: transfers can only be cancelled, debt rows live on Qarzlar. */
export function TransactionInfoModal({ transaction: tx, onClose, onCancelTransfer, onOpenDebt }: TransactionInfoModalProps) {
  const transfer = tx !== null && rowKind(tx) === 'transfer';
  const rows: [string, string][] = tx
    ? [
        [t('transactions.columns.date'), `${formatDate(tx.date)}, ${formatTime(tx.createdAt)}`],
        transfer ? [t('transactions.info.route'), transferRoute(tx)] : [t('transactions.info.person'), tx.debt?.personName ?? '—'],
        [t('transactions.columns.account'), tx.account.name],
        [t('transactions.columns.note'), tx.note || '—'],
      ]
    : [];

  return (
    <Modal
      isOpen={tx !== null}
      onClose={onClose}
      title={transfer ? t('common.transfer') : t('transactions.info.debtTitle')}
      footer={
        tx && (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
            {transfer ? (
              <Button variant="destructive" onClick={() => onCancelTransfer(tx)}>
                <Undo2 className="h-4 w-4" aria-hidden />
                {t('transactions.info.cancelTransfer')}
              </Button>
            ) : (
              <Button onClick={() => onOpenDebt(tx)} disabled={!tx.debtId}>
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('transactions.info.openDebt')}
              </Button>
            )}
          </>
        )
      }
    >
      {tx && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <TxTile tx={tx} size={48} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] text-text-muted">{typeLabel(tx.type)}</span>
              <span className={cn('whitespace-nowrap text-[24px] font-semibold leading-[30px] tracking-[-0.02em]', TONE_CLASS[toneOf(tx.type)])}>
                {formatAmount(tx.amount)}
              </span>
            </div>
          </div>
          <dl className="flex flex-col border-t border-border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-border py-3 text-[14px]">
                <dt className="text-text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2.5 rounded-[14px] bg-info-soft p-3.5 text-info">
            <Info className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
            <p className="text-pretty text-[14px] font-medium leading-5 text-text">
              {transfer
                ? t('transactions.info.transferNote')
                : t('transactions.info.debtNote')}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
