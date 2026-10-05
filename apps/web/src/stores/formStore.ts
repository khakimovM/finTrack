import { create } from 'zustand';

/** Forms the shell can open from anywhere (quick add, empty states, notifications). */
export type GlobalForm =
  | { kind: 'transaction'; type: 'INCOME' | 'EXPENSE' }
  | { kind: 'transfer' }
  | { kind: 'debt'; direction?: 'I_LENT' | 'I_BORROWED' };

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
