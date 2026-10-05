import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface UiState {
  /** What the user picked; "system" follows the OS. */
  theme: Theme;
  /** What is on screen right now. */
  resolvedTheme: ResolvedTheme;
  /** Inside Telegram the colour scheme follows the Telegram app and is not user-selectable. */
  telegramTheme: boolean;
  sidebarOpen: boolean;
  /** Explicit sidebar choice; null follows the width (full from 1200px, an icon rail below). */
  sidebarMode: 'full' | 'rail' | null;
  setSidebarMode: (mode: 'full' | 'rail') => void;
  setTheme: (theme: Theme) => void;
  /** Header button: flips what is on screen and remembers it as an explicit choice. */
  toggleTheme: () => void;
  followTelegramTheme: (scheme: ResolvedTheme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const STORAGE_KEY = 'fintrack-theme';
const darkQuery = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function readSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Private mode or blocked storage: fall back to the OS preference.
  }
  return 'system';
}

function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this visit.
  }
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme;
  return darkQuery()?.matches ? 'dark' : 'light';
}

function applyToDom(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  // Mobile browsers colour their toolbar from this meta; keep it on the page background.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const background = getComputedStyle(root).getPropertyValue('--background').trim();
    if (background) meta.setAttribute('content', background);
  }
}

export const useUiStore = create<UiState>((set, get) => {
  const initialTheme = readSavedTheme();
  const initialResolved = resolve(initialTheme);
  applyToDom(initialResolved);

  // "system" must follow the OS live, not only at load.
  darkQuery()?.addEventListener?.('change', () => {
    const { theme, telegramTheme } = get();
    if (theme !== 'system' || telegramTheme) return;
    const next = resolve('system');
    applyToDom(next);
    set({ resolvedTheme: next });
  });

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    telegramTheme: false,
    sidebarOpen: false,
    sidebarMode: null,
    setSidebarMode: (mode) => set({ sidebarMode: mode }),
    setTheme: (theme) => {
      saveTheme(theme);
      const resolved = resolve(theme);
      applyToDom(resolved);
      set({ theme, resolvedTheme: resolved });
    },
    toggleTheme: () => {
      const next: ResolvedTheme = get().resolvedTheme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },
    // Not persisted: the browser's saved preference must survive using the Mini App.
    followTelegramTheme: (scheme) => {
      applyToDom(scheme);
      set({ theme: scheme, resolvedTheme: scheme, telegramTheme: true });
    },
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
  };
});
