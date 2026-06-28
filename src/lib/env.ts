import { z } from 'zod';

const schema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_ENABLE_MOCK: z.enum(['true', 'false']).transform((v) => v === 'true'),
  VITE_SENTRY_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_SENTRY_ENVIRONMENT: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  VITE_SENTRY_RELEASE: z.string().optional(),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  VITE_STRIPE_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

type Env = z.infer<typeof schema>;

export function getEnv(): Env {
  // No cache: zod parse is ~µs and tests rely on re-reading env on every call
  // so vi.stubEnv() flips between tests.
  return schema.parse({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_ENABLE_MOCK: import.meta.env.VITE_ENABLE_MOCK,
    VITE_SENTRY_ENABLED: import.meta.env.VITE_SENTRY_ENABLED,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
    VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    VITE_SENTRY_RELEASE: import.meta.env.VITE_SENTRY_RELEASE,
    VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    VITE_STRIPE_ENABLED: import.meta.env.VITE_STRIPE_ENABLED,
  });
}

export const env: Env = new Proxy({} as Env, {
  get(_t, k) {
    return getEnv()[k as keyof Env];
  },
});

export type { Env };
