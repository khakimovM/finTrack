import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  /** Inside Telegram the colour scheme follows the Telegram app and is not user-selectable. */
  telegramTheme: boolean;
  sidebarOpen: boolean;
  setTheme: (theme: Theme) => void;
  followTelegramTheme: (scheme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const getInitialTheme = (): Theme => {
  const saved = localStorage.getItem('fintrack-theme') as Theme | null;
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'system';
};

const applyThemeToDom = (theme: Theme) => {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useUiStore = create<UiState>((set) => {
  const initialTheme = getInitialTheme();
  applyThemeToDom(initialTheme);

  return {
    theme: initialTheme,
    telegramTheme: false,
    sidebarOpen: false,
    setTheme: (theme) => {
      localStorage.setItem('fintrack-theme', theme);
      applyThemeToDom(theme);
      set({ theme });
    },
    // Not persisted: the browser's saved preference must survive using the Mini App.
    followTelegramTheme: (scheme) => {
      applyThemeToDom(scheme);
      set({ theme: scheme, telegramTheme: true });
    },
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
  };
});
