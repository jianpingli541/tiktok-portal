import Cookies from 'js-cookie';

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export type ConsentState = {
  /** Necessary cookies are always on — there is no UI to disable them. */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** ISO8601 timestamp of when the user last made a decision. `null` = undecided. */
  decidedAt: string | null;
};

export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  decidedAt: null,
};

export const CONSENT_STORAGE_KEY = 'tiktok-portal-consent';
export const CONSENT_COOKIE_KEY = 'tiktok-portal-consent';

/** LocalStorage is the source of truth — cookies are a server-readable mirror. */
function readStorage(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    // Defensive: a malformed / partial object should not crash callers.
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.analytics !== 'boolean' ||
      typeof parsed.marketing !== 'boolean'
    ) {
      return null;
    }
    return {
      necessary: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : null,
    };
  } catch {
    return null;
  }
}

function writeStorage(s: ConsentState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage may be disabled in private mode — swallow */
  }
}

function writeCookie(s: ConsentState): void {
  if (typeof document === 'undefined') return;
  // 365 days — GDPR guidance is at minimum 6 months, we use a year.
  Cookies.set(CONSENT_COOKIE_KEY, JSON.stringify(s), {
    expires: 365,
    sameSite: 'Lax',
    path: '/',
  });
}

export function getConsent(): ConsentState {
  return readStorage() ?? DEFAULT_CONSENT;
}

export function setConsent(s: ConsentState): void {
  writeStorage(s);
  writeCookie(s);
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  const s = getConsent();
  // Undecided users are treated as "denied" for non-necessary categories.
  if (s.decidedAt === null) return false;
  return s[category];
}
