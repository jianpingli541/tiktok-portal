# Design — TIKTON Portal

## Layered architecture

```
src/
├── app/          ← route groups (auth/account/workspace/marketing)
├── components/   ← presentational + shadcn primitives
├── lib/          ← cross-cutting (api, auth, env)
├── stores/       ← Zustand (UI state)
├── hooks/        ← TanStack Query (server state)
└── mocks/        ← MSW (dev/test only)
```

Each layer depends only on layers above it (app → components → lib → stores/hooks). Mocks are dev-only and must never reach the production bundle (verified by `grep mockServiceWorker dist/` in CI).

## Data flow

1. Component calls a TanStack Query hook (e.g. `useTasks()`).
2. Hook calls `apiClient.get('/v1/tasks', { headers })`.
3. `apiClient` prepends `VITE_API_BASE_URL`, attaches `Authorization: Bearer <token>` if session exists, retries once on network failure.
4. On 401, `setOnUnauthorized` callback (installed by `<Bootstrap>`) triggers `refresh()`; if that fails, the session is cleared and the user is redirected to login.
5. The parsed response is returned to the hook → React renders.

## MSW gating

`enableMocking()` is called at startup; it returns early unless `env.VITE_ENABLE_MOCK === true`. Production builds use a stripped Vite tree-shake because all MSW imports live behind a dynamic `import()`. CI asserts the `mockServiceWorker.js` file is NOT present in `dist/`.

## Why not Next.js?

User requirement: pure static build, deployable to any CDN/nginx. SSR adds operational complexity not justified by current SEO needs.