import { create } from 'zustand';
import type { TransactionResponse } from '@fintrack/shared';

/** Forms the shell can open from anywhere (quick add, empty states, notifications). */
export type GlobalForm =
  /** With `transaction` the form edits that income or expense instead of adding one. */
  | { kind: 'transaction'; type: 'INCOME' | 'EXPENSE'; transaction?: TransactionResponse }
  | { kind: 'transfer' }
  | { kind: 'debt'; direction?: 'I_LENT' | 'I_BORROWED' }
  | { kind: 'account' };

interface FormState {
  form: GlobalForm | null;
  open: (form: GlobalForm) => void;
  close: () => void;
}

export const useFormStore = create<FormState>((set) => ({
  form: null,
  open: (form) => set({ form }),
  close: () => set({ form: null }),
}));
