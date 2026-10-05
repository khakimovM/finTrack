import { useState, type FormEvent } from 'react';
import { Handshake } from 'lucide-react';
import { DebtResponse, todayLocalIso } from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Textarea } from '../../../components/ui/Textarea';
import { ChoiceGrid } from '../../../components/ui/ChoiceGrid';
import { formatAmount, formatAmountNumber } from '../../../lib/money';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { useCreateDebtPayment, useSettleDebt } from '../hooks/useDebts';

export interface DebtPaymentModalProps {
  debt: DebtResponse | null;
  /** pay: any part of the rest; settle: all of it in one payment. */
  mode?: 'pay' | 'settle';
  isOpen: boolean;
  onClose: () => void;
}

const OVERPAID = 'To‘lov summasi qoldiq qarzdan oshib ketdi';
const STRICT = 'Hisobda yetarli mablag‘ yo‘q (Qatʼiy rejim)';

export function DebtPaymentModal({ debt, mode = 'pay', isOpen, onClose }: DebtPaymentModalProps) {
  const settle = mode === 'settle';
  const today = todayLocalIso();
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.data ?? [];
  const createPayment = useCreateDebtPayment();
  const settleDebt = useSettleDebt();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useInitOnOpen(isOpen && debt !== null, accountsData !== undefined, () => {
    setAccountId((accounts.find((a) => a.isDefault) ?? accounts[0])?.id ?? '');
    setAmount('');
    setDate(today);
    setNote(settle ? 'Qarz to‘liq yopildi' : '');
    setAmountError(null);
    setError(null);
  });

  const remaining = BigInt(debt?.remainingAmount ?? '0');
  const over = !settle && /^\d+$/.test(amount) && BigInt(amount) > remaining;
  const busy = createPayment.isPending || settleDebt.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!debt) return;
    setError(null);
    if (!settle && !(/^\d+$/.test(amount) && BigInt(amount) > 0n)) return setAmountError('Summa 0 dan katta bo‘lishi kerak');
    if (over) return;
    try {
      const body = { accountId, paidAt: date, note: note.trim() || undefined };
      if (settle) await settleDebt.mutateAsync({ id: debt.id, data: body });
      else await createPayment.mutateAsync({ id: debt.id, data: { ...body, amount } });
      onClose();
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'DEBT_OVERPAYMENT') setAmountError(OVERPAID);
      else setError(code === 'INSUFFICIENT_BALANCE' ? STRICT : apiErrorToMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen && debt !== null}
      onClose={onClose}
      title={settle ? 'To‘liq yopish' : 'To‘lov kiritish'}
      description={settle ? `Qolgan ${formatAmount(remaining)} bitta to‘lov bilan yopiladi.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" form="debt-payment-form" loading={busy} disabled={over}>
            {settle ? 'Yopishni tasdiqlash' : 'Saqlash'}
          </Button>
        </>
      }
    >
      {debt && (
        <form id="debt-payment-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-[18px]" noValidate>
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3.5 py-3 text-[14px] font-semibold">
            <Handshake className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
            <span className="text-pretty">
              {debt.personName} · Joriy qoldiq: {formatAmount(remaining)}
            </span>
          </div>
          <ChoiceGrid
            label={debt.direction === 'I_LENT' ? 'Qaysi hisobga tushadi' : 'Qaysi hisobdan to‘lanadi'}
            columns={2}
            phoneColumns={1}
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({
              value: a.id,
              label: a.name,
              emoji: a.icon,
              color: a.color,
              sub: formatAmount(a.balance, { sign: 'negative' }),
            }))}
          />
          {!settle && (
            <MoneyInput
              label="To‘lov summasi"
              size="md"
              autoFocus
              value={amount}
              onChange={(value) => {
                setAmount(value);
                setAmountError(null);
              }}
              error={over ? OVERPAID : amountError ?? undefined}
              chips={[{ label: `Hammasi · ${formatAmountNumber(remaining)}`, value: remaining.toString() }]}
            />
          )}
          <DatePicker label="Sana" value={date} onChange={setDate} chips={['today', 'yesterday']} max={today} today={today} />
          <Textarea
            label="Izoh"
            placeholder={settle ? undefined : 'Masalan: Qisman qaytardi'}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
