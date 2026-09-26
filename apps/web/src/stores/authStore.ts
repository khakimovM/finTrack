import { create } from 'zustand';
import { UserResponse } from '@fintrack/shared';
import { api } from '../lib/api';

interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserResponse | null) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore logout network errors
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
