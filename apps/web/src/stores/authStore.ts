import { create } from 'zustand';
import { UserResponse } from '@fintrack/shared';
import { api } from '../lib/api';
import { resetSessionCache } from '../lib/queryClient';

interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserResponse | null) => void;
  /** Call after a successful login: clears any cache left by a previous session. */
  signIn: (user: UserResponse) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  signIn: (user) => {
    resetSessionCache();
    set({ user, isAuthenticated: true, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // The session is being discarded locally either way.
    } finally {
      resetSessionCache();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
