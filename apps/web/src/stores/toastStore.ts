import { create } from 'zustand';
import { EXIT_MS, prefersReducedMotion } from '../lib/motion';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  action?: ToastAction;
  /** Milliseconds on screen; 0 keeps it until closed. Drives the undo progress bar. */
  durationMs: number;
  /** Dismissed and animating out; removed from the list once the exit ends. */
  leaving?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id' | 'durationMs' | 'leaving'>, durationMs?: number) => string;
  removeToast: (id: string) => void;
}

const DEFAULT_MS = 3000;
const UNDO_MS = 6000;
const MAX_VISIBLE = 3;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (toast, durationMs = DEFAULT_MS) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id, durationMs }].slice(-MAX_VISIBLE) }));

    if (durationMs > 0) setTimeout(() => get().removeToast(id), durationMs);
    return id;
  },
  removeToast: (id) => {
    const drop = () => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    if (prefersReducedMotion()) {
      drop();
      return;
    }
    set((state) => ({ toasts: state.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(drop, EXIT_MS.base);
  },
}));

const add = (type: ToastType, message: string, title?: string, durationMs?: number) =>
  useToastStore.getState().addToast({ type, message, title }, durationMs);

export const toast = {
  success: (message: string, title?: string) => add('success', message, title),
  error: (message: string, title?: string) => add('error', message, title, 5000),
  info: (message: string, title?: string) => add('info', message, title),
  warning: (message: string, title?: string) => add('warning', message, title, 5000),
  /** "Tranzaksiya o‘chirildi · Qaytarish" — six seconds to take the action back. */
  undo: (message: string, onUndo: () => void) => {
    const store = useToastStore.getState();
    const id = store.addToast(
      {
        type: 'success',
        message,
        action: {
          label: 'Qaytarish',
          onClick: () => {
            useToastStore.getState().removeToast(id);
            onUndo();
          },
        },
      },
      UNDO_MS,
    );
    return id;
  },
};
