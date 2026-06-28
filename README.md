# TIKTON Portal

Creator-facing portal for the TIKTON video repurposing platform. Pure static SPA, talks to the public TIKTON API.

## Quick start

```bash
pnpm install
cp .env.example .env.local
# edit .env.local: VITE_API_BASE_URL=...; VITE_ENABLE_MOCK=true (dev only)
pnpm dev
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Vite dev server on :5173 |
| `pnpm build` | Type-check + production build to `dist/` |
| `pnpm preview` | Preview production build locally |
| `pnpm typecheck` | TS strict type check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright e2e (auto-starts dev server with MSW) |

## Production deployment

1. Build the image: `docker build -t tiktok-portal:latest .`
2. Run: `docker run -d -p 80:80 tiktok-portal:latest`
3. Verify: `curl http://localhost/healthz` returns `ok`.

## Architecture

See [`docs/DESIGN.md`](docs/DESIGN.md) for component layout, data flow, and decisions.
See [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md) for the API contract this client targets.

## Development Workflow

### Pre-commit gate

Before opening a PR, run the same gates CI runs, locally:

```bash
bash scripts/ci-local.sh
```

The script runs: `pnpm install --frozen-lockfile` → `typecheck` → `lint` → `test` → `build` → MSW leak guard. Any failure exits non-zero; the local output matches what GitHub Actions would surface.

Optional: wire it as a `pre-push` hook — `ln -s ../../scripts/ci-local.sh .git/hooks/pre-push`.

### Pull request flow

1. Branch off `main` with a Conventional prefix: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, `test/`.
2. Commit using Conventional Commits (`feat: ...`, `fix(scope): ...`).
3. Push the branch and open a PR targeting `main`.
4. Wait for the four required status checks to be green:
   - `build (20)` — typecheck + lint + test + build + MSW guard on Node 20
   - `build (22)` — same matrix on Node 22
   - `Docker build (linux/amd64)` — Dockerfile still produces a valid image
5. Get one approving review (branch protection enforces this).
6. Merge via squash or rebase — linear history is required.

### CI pipeline overview

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push to `main`, PR, manual | Fast feedback (typecheck / lint / unit tests / build / MSW guard) on Node 20 + 22 |
| `docker.yml` | push to `main`, PR, manual | Multi-arch (amd64 + arm64) image build, push to GHCR on `main`, Trivy scan |
| `release.yml` | push tag `v*.*.*` | Build, package `dist`, generate changelog via git-cliff, create GitHub Release |
| `e2e-nightly.yml` | cron `0 2 * * *` UTC, manual | Playwright e2e against Chromium; non-blocking signal |

### Tagging a release

```bash
git tag v0.2.0
git push origin v0.2.0
```

This triggers `release.yml`, which produces a GitHub Release with the zip artifact and Conventional-Commits changelog.

### Required repository configuration (one-time, manual)

Under Settings → Environments, create a `production` environment with a `VITE_API_BASE_URL` variable. Under Settings → Variables → Actions, add `VITE_API_BASE_URL_STAGING` for PR builds.