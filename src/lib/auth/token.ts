import { create } from 'zustand';
import type { AuthSession } from '@/lib/api/types';

interface TokenState {
  session: AuthSession | null;
  setSession: (s: AuthSession | null) => void;
  clear: () => void;
}

export const useTokenStore = create<TokenState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clear: () => set({ session: null }),
}));
