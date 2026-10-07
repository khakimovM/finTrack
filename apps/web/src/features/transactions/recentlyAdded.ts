import { create } from 'zustand';

/** Long enough for the list to refetch and show the row; short enough not to replay on a later visit. */
const KEEP_MS = 4000;

interface RecentlyAddedState {
  id: string | null;
  mark: (id: string) => void;
}

/** The transaction just saved from the form, so its row can be tinted for a moment. */
export const useRecentlyAdded = create<RecentlyAddedState>((set) => ({
  id: null,
  mark: (id) => {
    set({ id });
    setTimeout(() => set((state) => (state.id === id ? { id: null } : state)), KEEP_MS);
  },
}));
