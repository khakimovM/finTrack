import { useFormStore } from '../../stores/formStore';
import { TransactionModal } from '../../features/transactions/components/TransactionModal';
import { TransferModal } from '../../features/accounts/components/TransferModal';
import { DebtModal } from '../../features/debts/components/DebtModal';
import { AccountModal } from '../../features/accounts/components/AccountModal';

/** Mounts the forms opened through the form store, once, at the shell level. */
export function GlobalForms() {
  const { form, close } = useFormStore();
  return (
    <>
      <TransactionModal
        isOpen={form?.kind === 'transaction'}
        onClose={close}
        defaultType={form?.kind === 'transaction' ? form.type : 'EXPENSE'}
      />
      <TransferModal isOpen={form?.kind === 'transfer'} onClose={close} />
      <DebtModal
        isOpen={form?.kind === 'debt'}
        onClose={close}
        defaultDirection={form?.kind === 'debt' ? form.direction : undefined}
      />
      <AccountModal isOpen={form?.kind === 'account'} onClose={close} />
    </>
  );
}
