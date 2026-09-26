import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  setTheme: (theme: Theme) => void;
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
    sidebarOpen: false,
    setTheme: (theme) => {
      localStorage.setItem('fintrack-theme', theme);
      applyThemeToDom(theme);
      set({ theme });
    },
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
  };
});
