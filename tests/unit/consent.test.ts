import { describe, it, expect, beforeEach } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT,
  getConsent,
  hasConsent,
  setConsent,
  type ConsentState,
} from '@/lib/consent';

describe('consent.getConsent', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns DEFAULT_CONSENT when storage is empty', () => {
    expect(getConsent()).toEqual(DEFAULT_CONSENT);
  });

  it('returns DEFAULT_CONSENT when storage is malformed', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'not-json');
    expect(getConsent()).toEqual(DEFAULT_CONSENT);
  });

  it('returns DEFAULT_CONSENT when required fields are missing', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ analytics: true }));
    const s = getConsent();
    expect(s.analytics).toBe(DEFAULT_CONSENT.analytics);
    expect(s.marketing).toBe(DEFAULT_CONSENT.marketing);
    expect(s.necessary).toBe(true);
  });

  it('round-trips a previously written state', () => {
    const written: ConsentState = {
      necessary: true,
      analytics: true,
      marketing: false,
      decidedAt: '2026-06-28T12:00:00.000Z',
    };
    setConsent(written);
    expect(getConsent()).toEqual(written);
  });
});

describe('consent.setConsent', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // js-cookie writes to document.cookie — clear it too.
    document.cookie = `${CONSENT_STORAGE_KEY}=; Max-Age=0; path=/`;
  });

  it('writes the state to localStorage under CONSENT_STORAGE_KEY', () => {
    const s: ConsentState = {
      necessary: true,
      analytics: true,
      marketing: true,
      decidedAt: '2026-06-28T12:00:00.000Z',
    };
    setConsent(s);
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(s);
  });

  it('writes a mirror cookie readable from document.cookie', () => {
    const s: ConsentState = {
      necessary: true,
      analytics: false,
      marketing: false,
      decidedAt: '2026-06-28T12:00:00.000Z',
    };
    setConsent(s);
    expect(document.cookie).toContain(CONSENT_STORAGE_KEY);
  });
});

describe('consent.hasConsent', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${CONSENT_STORAGE_KEY}=; Max-Age=0; path=/`;
  });

  it('returns true for necessary regardless of decision', () => {
    expect(hasConsent('necessary')).toBe(true);
    setConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      decidedAt: '2026-06-28T12:00:00.000Z',
    });
    expect(hasConsent('necessary')).toBe(true);
  });

  it('returns false for analytics/marketing when undecided', () => {
    expect(hasConsent('analytics')).toBe(false);
    expect(hasConsent('marketing')).toBe(false);
  });

  it('returns the stored value once the user has decided', () => {
    setConsent({
      necessary: true,
      analytics: true,
      marketing: false,
      decidedAt: '2026-06-28T12:00:00.000Z',
    });
    expect(hasConsent('analytics')).toBe(true);
    expect(hasConsent('marketing')).toBe(false);
  });
});
