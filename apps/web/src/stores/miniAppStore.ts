import { create } from 'zustand';

/**
 * off: a normal browser tab. ready: signed in through Telegram. The rest block the app with an
 * explanation: not registered in the bot yet, launch data too old, opened without initData
 * (e.g. from a keyboard button), or the exchange failed for another reason.
 */
export type MiniAppStatus = 'off' | 'ready' | 'unregistered' | 'banned' | 'expired' | 'no-init-data' | 'error';

interface MiniAppState {
  status: MiniAppStatus;
  setStatus: (status: MiniAppStatus) => void;
}

export const useMiniAppStore = create<MiniAppState>((set) => ({
  status: 'off',
  setStatus: (status) => set({ status }),
}));

export const isMiniApp = (status: MiniAppStatus) => status !== 'off';
