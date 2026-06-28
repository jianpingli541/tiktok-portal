import { create } from 'zustand';
import {
  DEFAULT_CONSENT,
  type ConsentState,
  setConsent as persistConsent,
} from '@/lib/consent';

interface ConsentStoreState {
  state: ConsentState;
  /** True when the user has the preferences modal/banner open. */
  isOpen: boolean;
  /** Open the banner / preferences modal. */
  open: () => void;
  /** Close the banner / preferences modal without writing. */
  close: () => void;
  /** Accept all categories (necessary=true always; analytics/marketing=true). */
  acceptAll: () => void;
  /** Reject all non-necessary categories. */
  rejectAll: () => void;
  /**
   * Save the user's per-category choice.
   * @param analytics analytics consent
   * @param marketing marketing consent
   */
  save: (analytics: boolean, marketing: boolean) => void;
  /** Reset to defaults (undecided). Used by "reset preferences" admin actions. */
  reset: () => void;
}

export const useConsentStore = create<ConsentStoreState>((set) => ({
  state: DEFAULT_CONSENT,
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  acceptAll: () => {
    const next: ConsentState = {
      necessary: true,
      analytics: true,
      marketing: true,
      decidedAt: new Date().toISOString(),
    };
    persistConsent(next);
    set({ state: next, isOpen: false });
  },
  rejectAll: () => {
    const next: ConsentState = {
      necessary: true,
      analytics: false,
      marketing: false,
      decidedAt: new Date().toISOString(),
    };
    persistConsent(next);
    set({ state: next, isOpen: false });
  },
  save: (analytics, marketing) => {
    const next: ConsentState = {
      necessary: true,
      analytics,
      marketing,
      decidedAt: new Date().toISOString(),
    };
    persistConsent(next);
    set({ state: next, isOpen: false });
  },
  reset: () => {
    persistConsent(DEFAULT_CONSENT);
    set({ state: DEFAULT_CONSENT, isOpen: false });
  },
}));
