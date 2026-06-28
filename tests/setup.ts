import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Provide default VITE_* values for unit tests so modules that import
// `@/lib/env` at module-evaluation time (e.g. `@/lib/api/client`) succeed.
// Individual tests can override with `vi.stubEnv()`.
vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
vi.stubEnv('VITE_ENABLE_MOCK', 'false');
// Default Sentry to disabled so modules that import `@/lib/env` at
// evaluation time don't fail zod parsing on missing optional fields.
// Individual observability tests override with vi.stubEnv as needed.
vi.stubEnv('VITE_SENTRY_ENABLED', 'false');
vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'development');

// jsdom's default origin is opaque (about:blank), which makes
// `window.localStorage` throw SecurityError. Polyfill a minimal
// in-memory Storage so tests that touch localStorage (e.g. i18next's
// LanguageDetector) can run without flakiness.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    writable: false,
    configurable: true,
  });
}
