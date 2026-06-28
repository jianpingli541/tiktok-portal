# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**TIKTON Portal** — creator-facing single-page web app for the TIKTON video-repurposing platform. Pure static React/TS build, no SSR, served behind nginx. Talks to the public TIKTON REST API (contract v1, see [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md)).

## Commands

All scripts are run via `pnpm` (Node ≥20). Enable corepack first if `pnpm` is missing: `corepack enable && corepack prepare pnpm@latest --activate`.

| Command | Purpose |
|---|---|
| `pnpm install` | Install deps |
| `pnpm dev` | Vite dev server on `:5173` (set `VITE_ENABLE_MOCK=true` in `.env.local` for mocks) |
| `pnpm build` | `tsc -b` strict type-check + Vite production build → `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | TS strict check only (`tsc -b --noEmit`) |
| `pnpm lint` | ESLint over `.ts` / `.tsx` |
| `pnpm format` | Prettier write |
| `pnpm test` | Vitest single-run (unit) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright e2e — auto-starts `VITE_ENABLE_MOCK=true pnpm dev` per `playwright.config.ts` |
| `pnpm exec playwright install --with-deps chromium` | One-time browser install (required before e2e) |

### Single-test patterns

- Unit (Vitest): `pnpm test -- tests/unit/<file>.test.ts` or `pnpm test -- -t "<test name>"`.
- e2e (Playwright): `pnpm test:e2e -- tests/e2e/<file>.spec.ts` or `pnpm test:e2e -- -g "<spec name>"`.

### Production bundle safety check

`pnpm build` MUST NOT include `mockServiceWorker.js` in `dist/` — verify with `grep -r mockServiceWorker dist/`. MSW imports are gated by `import.meta.env.DEV` so a production build tree-shakes them; if this check ever fails, MSW has leaked (see [`src/main.tsx`](src/main.tsx) `enableMocking()`).

## Architecture

See [`docs/DESIGN.md`](docs/DESIGN.md) for the authoritative layered design. Quick map:

```
src/
├── main.tsx              ← entry: QueryClientProvider, Bootstrap, MSW gating
├── app/                  ← routes grouped by audience
│   ├── (marketing)/      ← Landing, Pricing (public)
│   ├── (auth)/           ← Login, Register, VerifyEmail, ForgotPassword
│   ├── (account)/        ← Account, Billing (RequireAuth-protected)
│   ├── (workspace)/      ← Submit, TaskList, TaskDetail (RequireAuth-protected)
│   ├── Layout.tsx        ← single Layout element around the matched child
│   ├── RequireAuth.tsx   ← pure Outlet guard (no extra Layout)
│   └── router.tsx        ← react-router-dom v6 data router
├── components/
│   ├── ui/               ← shadcn primitives (button, input, dialog, ...)
│   └── layout/           ← AppShell, Sidebar, Topbar
├── lib/
│   ├── api/              ← client.ts (only place that calls fetch), types.ts, errors.ts
│   ├── auth/             ← token store (Zustand) + useAuth hook
│   ├── queryClient.ts    ← shared QueryClient
│   ├── env.ts            ← zod-validated VITE_* env
│   └── utils.ts          ← cn() (clsx + tailwind-merge)
├── hooks/                ← TanStack Query hooks (useTasks, usePlans, useSubscriptions)
├── stores/               ← Zustand stores (ui.ts and others)
├── mocks/                ← MSW handlers + fixtures (DEV ONLY, never bundled)
└── styles/               ← Tailwind entry (index.css)
```

Layers depend downward only: `app → components → lib → stores/hooks`. Mocks are dev-only and must never reach production (verified in CI via `grep mockServiceWorker dist/`).

## Data flow (request → render)

1. Page calls a query hook (e.g. `useTasks()` in `src/hooks/useTasks.ts`).
2. Hook calls `apiClient.get('/v1/tasks', { headers })` — `apiClient` is the ONLY place `fetch()` is allowed (enforced by [`AGENTS.md`](AGENTS.md)).
3. `apiClient` ([`src/lib/api/client.ts`](src/lib/api/client.ts)) prepends `VITE_API_BASE_URL`, attaches `Authorization: Bearer <token>` if a session exists, retries once on network failure, and on 401 calls the `onUnauthorized` callback.
4. `<Bootstrap>` in `main.tsx` installs that callback to `useAuth().refresh()`; if refresh fails, the session is cleared and the user is bounced to `/login`.
5. Response → hook → React renders. Errors throw `ApiError(status, code, message, body)` ([`src/lib/api/errors.ts`](src/lib/api/errors.ts)) — match against the contract in `docs/API-CONTRACT.md`.

## State management

- **Server state** — TanStack Query v5; the shared `queryClient` lives in `src/lib/queryClient.ts`. Mutations invalidate `['tasks']` etc. Polling for active tasks: `useTask` refetches every 5s while status is `pending`/`running`.
- **Auth/session** — Zustand store `useTokenStore` ([`src/lib/auth/token.ts`](src/lib/auth/token.ts)) holds the `AuthSession`. `useAuth()` is the only public surface (`login`/`register`/`refresh`/`logout`).
- **UI state** — Zustand `src/stores/ui.ts`.

## Routing model

React Router v6 data router with a single `<Layout>` parent. Public routes (`/`, `/pricing`, `/login`, `/register`, `/verify-email`, `/forgot-password`) and the catch-all 404 render directly under Layout. Account/workspace routes (`/account`, `/billing`, `/submit`, `/tasks`, `/tasks/:id`) sit behind `<RequireAuth>` — a pure `<Outlet>` guard, no second Layout.

When adding a new protected route, append to the `RequireAuth` `children` array in `src/app/router.tsx`. Public routes go in the outer `children`.

## API contract summary

Full table in [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md). Version **v1**. All endpoints under `/v1`. Auth: `Authorization: Bearer <access_token>` for everything except `register`, `login`, `forgot-password`, `plans`. Error shape: `{ code, message, upgrade_url? }`. Status codes: 400 / 401 / 402 / 429 / 5xx. DTOs in [`src/lib/api/types.ts`](src/lib/api/types.ts) MUST stay in sync with the contract.

## Environment variables

Validated by zod in [`src/lib/env.ts`](src/lib/env.ts) at startup. Only `VITE_*` vars are exposed to the browser.

| Var | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | yes | Full URL of the TIKTON API (no trailing slash) |
| `VITE_ENABLE_MOCK` | yes | `"true"` enables MSW in dev/test; `"false"` for production builds and e2e-against-real-API |

The Dockerfile accepts both as `ARG` so a single image can be rebuilt for different environments.

## Conventions (from AGENTS.md — enforce strictly)

- All API calls go through `src/lib/api/client.ts`. Never call `fetch()` directly elsewhere.
- MSW (`./mocks`) MUST only execute under `VITE_ENABLE_MOCK=true`; production builds must not contain `mockServiceWorker`.
- Tailwind utilities only. No CSS-in-JS, no styled-components.
- TypeScript strict; no `any` without a justifying comment.
- Commit messages: Conventional Commits (`feat:` `fix:` `chore:` `docs:` `refactor:` `test:`).
- Path alias `@/` → `src/` (works in Vite, Vitest, and TypeScript via `vite.config.ts` + `tsconfig.json`).

## Testing strategy

- **Unit (Vitest, jsdom)** — `tests/unit/`. Setup file `tests/setup.ts`. Run with `pnpm test`.
- **e2e (Playwright, chromium)** — `tests/e2e/`. `playwright.config.ts` boots `VITE_ENABLE_MOCK=true pnpm dev` automatically; first-time setup requires `pnpm exec playwright install --with-deps chromium`.
- **MSW fixtures** — `src/mocks/fixtures/{plans,tasks}.ts`. e2e and dev both run against these, so changes here affect both surfaces.

## Deployment

Multi-stage Docker: `node:20-alpine` (build with pnpm) → `nginx:1.27-alpine` (serve `dist/` as non-root `app` user). `nginx.conf` provides SPA fallback (`try_files $uri /index.html`), static-asset long caching for hashed assets, gzip, security headers, and `/healthz` → 200 `ok` for liveness probes.

```bash
docker build -t tiktok-portal:latest \
  --build-arg VITE_API_BASE_URL=https://api.your-domain.example \
  --build-arg VITE_ENABLE_MOCK=false .
docker run -d -p 80:80 tiktok-portal:latest
curl http://localhost/healthz  # → ok
```

Always pass `VITE_API_BASE_URL` and `VITE_ENABLE_MOCK=false` as build args in production — defaults in the Dockerfile point at a placeholder `https://api.example.com` and `mock=false`.

## Key references

- [`docs/DESIGN.md`](docs/DESIGN.md) — layered architecture, data flow, MSW gating rationale
- [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md) — frozen v1 contract
- [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) — end-to-end user flows (register → pricing → submit → task detail)
- [`AGENTS.md`](AGENTS.md) — project operating rules
- [`_bootstrap/README.md`](_bootstrap/README.md) — full bootstrap/verify checklist (install.sh, manual steps, troubleshooting)
- [`components.json`](components.json) — shadcn/ui config (new-york style, zinc base, CSS variables on)