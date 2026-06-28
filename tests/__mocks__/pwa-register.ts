// Test stub for `virtual:pwa-register` (provided by vite-plugin-pwa at
// build time only). Replaces the real module so unit tests can import
// main.tsx without crashing on a missing virtual id.
export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

export function registerSW(_options: RegisterSWOptions = {}): (reloadPage?: boolean) => Promise<void> {
  return async () => {
    /* no-op in tests */
  };
}