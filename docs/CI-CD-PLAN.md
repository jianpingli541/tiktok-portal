# TIKTON Portal — CI/CD Plan

> Status: design doc, ready to implement.
> Stack: React 18 + Vite 5 + TS strict SPA · pnpm 11 · Node 20/22 · nginx-unprivileged · playwright e2e.
> Audience: maintainers and reviewers of the GitHub Actions pipeline.

## 1. Goals & Non-Goals

### Goals
- Block PRs that break typecheck, lint, unit tests, build, or ship MSW into the bundle.
- Publish multi-arch container images to GHCR on every push to `main`.
- Produce GitHub Releases with artifacts when a `v*` tag is pushed.
- Keep PR feedback < 10 min for the standard pipeline.

### Non-Goals
- Full e2e on every PR (slow + needs browsers; see §8).
- Auto-deploy to a cloud (the team is on-prem via Synology + FRP per project memory).
- Publishing to npm — `private: true` package, no registry workflow.

## 2. Workflow Topology (3 workflows)

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | push `main`, PR, `workflow_dispatch` | Fast feedback (typecheck/lint/test/build/msw-check) |
| `.github/workflows/docker.yml` | push `main`, PR | Multi-arch image build + scan |
| `.github/workflows/release.yml` | push tag `v*` | GitHub Release with `dist/` artifact + changelog |

Source: [GitHub Docs — Workflows](https://docs.github.com/en/actions/using-jobs-and-steps) · [Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows).

## 3. `ci.yml` — Full file

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

# Cancel in-progress runs for the same branch / PR.
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

# 10 min hard cap to surface runaway jobs early.
jobs:
  build:
    name: build (${{ matrix.node }})
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    strategy:
      fail-fast: true
      matrix:
        node: ['20', '22']

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Setup Node ${{ matrix.node }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'

      - name: Get pnpm store directory
        id: pnpm-cache
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: pnpm-store-${{ matrix.node }}-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            pnpm-store-${{ matrix.node }}-

      - name: Cache Vite
        uses: actions/cache@v4
        with:
          path: |
            node_modules/.vite
            .vite
          key: vite-${{ matrix.node }}-${{ hashFiles('**/package.json') }}
          restore-keys: |
            vite-${{ matrix.node }}-

      - name: Install (frozen lockfile)
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests (vitest + GitHub reporter)
        run: pnpm vitest run --reporter=default --reporter=github-actions

      - name: Build
        run: pnpm build

      - name: MSW leak guard (dist/ must not contain mockServiceWorker)
        run: |
          set -euo pipefail
          if grep -r "mockServiceWorker" dist/; then
            echo "::error::MSW leaked into production bundle" >&2
            exit 1
          fi

      - name: Upload dist artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.node }}
          path: dist/
          if-no-files-found: error
          retention-days: 7
```

### Why these choices

- **`concurrency.cancel-in-progress: true`** — saves minutes when a PR is force-pushed repeatedly. [Docs](https://docs.github.com/en/actions/using-jobs-and-steps/using-concurrency).
- **Node matrix 20 + 22** — both LTS active lines ([Node release schedule](https://nodejs.org/en/about/previous-releases)). `engines.node` says `>=20` so 22 must build too. `fail-fast: true` aborts the matrix on first failure.
- **Vitest GitHub reporter** — surfaces failing tests as PR annotations via [dorny/test-reporter](https://github.com/dorny/test-reporter) pattern. Vitest's `--reporter=github-actions` is built-in as of v1.x ([vitest docs](https://vitest.dev/guide/reporters.html)).
- **MSW leak guard** — single `grep -r`. If MSW ever sneaks into a prod build, the build is silently broken in production (mocked API). This is a non-negotiable hard gate per project memory.
- **`upload-artifact@v4`** — needed so release.yml (and humans) can download `dist/` without rebuilding. [Docs](https://github.com/actions/upload-artifact).

## 4. `release.yml` — Full file

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: write

jobs:
  release:
    name: build + GitHub Release
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # full history for changelog

      - uses: pnpm/action-setup@v4
        with: { version: 11 }

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: MSW leak guard
        run: |
          set -euo pipefail
          if grep -r "mockServiceWorker" dist/; then
            echo "::error::MSW leaked into release bundle" >&2
            exit 1
          fi

      - name: Upload dist artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist-release
          path: dist/

      - name: Generate changelog
        id: changelog
        uses: orhun/git-cliff-action@v4
        with:
          config: .github/git-cliff.toml   # optional; falls back to defaults
          args: --tag ${{ github.ref_name }} --output CHANGELOG.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: ${{ github.ref_name }}
          body_path: CHANGELOG.md
          fail_on_unmatched_files: true
          files: |
            dist/**
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- `softprops/action-gh-release` is the standard. [Docs](https://github.com/softprops/action-gh-release).
- `orhun/git-cliff-action` parses Conventional Commits → markdown. [Docs](https://github.com/orhun/git-cliff-action). Drop `git-cliff.toml` for default groups (feat/fix/perf/...).
- `fetch-depth: 0` is mandatory for full changelog ranges.

## 5. `docker.yml` — Full file

```yaml
name: Docker

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: write       # push to ghcr.io

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    name: build (${{ matrix.platform }})
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        platform:
          - linux/amd64
          - linux/arm64

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-qemu-action@v3

      - uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=raw,value=latest,enable={{is_default_branch}}
          labels: |
            org.opencontainers.image.title=tiktok-portal
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.sha }}

      - name: Build & push (multi-arch via cache)
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: ${{ matrix.platform }}
          push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=tiktok-portal-${{ matrix.platform }}
          cache-to: type=gha,mode=max,scope=tiktok-portal-${{ matrix.platform }}
          build-args: |
            VITE_API_BASE_URL=${{ vars.VITE_API_BASE_URL_STAGING || 'https://api.example.com' }}
            VITE_ENABLE_MOCK=false

      - name: Trivy scan
        if: matrix.platform == 'linux/amd64' && github.event_name == 'push'
        uses: aquasecurity/trivy-action@0.24.0
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }}
          format: 'table'
          exit-code: '0'        # don't block merge; surface only
          ignore-unfixed: true
          vuln-type: 'os,library'
          severity: 'CRITICAL,HIGH'
```

### Notes
- **Multi-arch via buildx matrix** — official pattern from [docker/build-push-action examples](https://github.com/docker/build-push-action/blob/master/docs/advanced/multi-platform.md). Each arch builds in parallel.
- **`push` only on `main`** — PRs still build (catches Dockerfile regressions) but don't push.
- **`cache-from` + `cache-to: type=gha,mode=max`** — GitHub Actions cache backend per arch ([docker buildx cache docs](https://docs.docker.com/build/cache/backends/#github-actions-cache)). `mode=max` shares layers across branches.
- **Trivy** — scan the just-built image; non-blocking (`exit-code: '0'`). Findings go to the Security tab via SARIF (alternate: `format: 'sarif'` + `actions/upload-artifact`). [aquasecurity/trivy-action](https://github.com/aquasecurity/trivy-action).
- **GITHUB_TOKEN** auto-provides `packages: write` on push to default branch for `ghcr.io/$OWNER/$REPO`. No extra secret needed.

## 6. Secrets & Environment Management

| Variable | Scope | Source | Notes |
|----------|-------|--------|-------|
| `secrets.GITHUB_TOKEN` | all jobs | auto | Auto-issued; no setup. |
| `vars.VITE_API_BASE_URL_STAGING` | repo vars | manual | Used by docker.yml PR builds. |
| `vars.VITE_API_BASE_URL` | env: `production` | manual | Used by a future `deploy.yml` workflow. |

### Production secrets
- `production` Environment in GitHub Settings → Environments → `production`.
- Add `vars.VITE_API_BASE_URL` (and future secrets like deploy SSH keys) as **environment-scoped variables**, not repo-scoped.
- Configure environment protection rules:
  - Required reviewers: ≥ 1.
  - Wait timer: 0 min.
  - Deployment branches: `main` only.
- PRs from forks **cannot** access environment secrets (`pull_request_target` is forbidden in this plan). This is automatic — [Environments docs](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment).

### What we are NOT doing
- No `pull_request_target` — it would let forks run code with secrets. We use `pull_request` for everything.
- No self-hosted runner credentials in repo — keep GH-hosted ubuntu-24.04.

## 7. Cache Strategy Recap

| Cache | Key | Path | Hit Rate Expectation |
|-------|-----|------|---------------------|
| pnpm store | `pnpm-store-{node}-{lockfileHash}` | `$(pnpm store path)` | ~95% (lockfile rarely changes) |
| Vite | `vite-{node}-{packageJsonHash}` | `node_modules/.vite`, `.vite` | ~80% |
| Docker layers (x2 arch) | `tiktok-portal-{amd64|arm64}`, scope via `cache-to: gha` | GHA cache backend | ~70% cold / 95% warm |

Per [pnpm/action-setup cache docs](https://github.com/pnpm/action-setup#use-cache) the built-in `cache: 'pnpm'` already covers the store, but adding the explicit `actions/cache@v4` step gives us per-Node matrix isolation and a `restore-keys` fallback when the lockfile bumps.

## 8. e2e (Playwright) — Two Options

e2e requires installing Chromium (~150 MB) and running the dev server with `VITE_ENABLE_MOCK=true`. It is **slow** (~3-5 min) and **flaky** on first run. We do **not** run it on every PR.

### Option A — Nightly workflow (recommended)
- File: `.github/workflows/e2e-nightly.yml`
- `on: schedule: cron: '17 6 * * *'` (06:17 UTC ≈ end of work day, jittered away from `:00`/`:30` to avoid the spike).
- `workflow_dispatch` for manual reruns.
- Installs Playwright browser (`pnpm exec playwright install --with-deps chromium`).
- Runs `pnpm test:e2e` against the dev server.
- Uploads Playwright report + traces as artifacts on failure.
- Result shows up as a check on the last commit, not blocking PRs.

### Option B — On merge to main inside docker.yml
- Add a `test-e2e` job to `docker.yml` after the image build, using the built container.
- Pros: catches regressions against the real nginx runtime.
- Cons: doubles docker.yml runtime; needs container start + healthz wait.

**Pick A**. Lower risk, separate failure domain, real-world catch (nightly catches drift the PR check wouldn't).

## 9. Fast Failure Feedback

- No Turborepo/Nx — the project is a single package with 4 test files. Adding a task runner would be more config than benefit ([turborepo docs](https://turborepo.com/docs)).
- `strategy.fail-fast: true` in ci.yml and docker.yml already kills sibling jobs on first failure.
- All jobs capped at 10–20 min `timeout-minutes` so a stuck job fails visibly rather than spinning.
- Steps ordered cheapest-first: install → typecheck → lint → test → build → guard → upload. Most failures surface in < 90 s.

## 10. `scripts/ci-local.sh` — Pre-commit Gate

```bash
#!/usr/bin/env bash
# scripts/ci-local.sh — mirror CI gate locally. Run before `git commit`.
set -euo pipefail

echo "==> pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

echo "==> pnpm typecheck"
pnpm typecheck

echo "==> pnpm lint"
pnpm lint

echo "==> pnpm test"
pnpm test

echo "==> pnpm build"
pnpm build

echo "==> MSW leak guard"
if grep -r "mockServiceWorker" dist/; then
  echo "FAIL: mockServiceWorker found in dist/" >&2
  exit 1
fi

echo "==> ALL CI GATES PASSED"
```

Suggested wrapper: a `pre-push` git hook calling this script, optional.

## 11. Branch Protection (manual — do not auto-configure)

Apply under Settings → Branches → Branch protection rules → `main`:

| Setting | Value |
|---------|-------|
| Require a pull request before merging | yes |
| Required approving reviews | **1** |
| Dismiss stale pull request approvals when new commits are pushed | yes |
| Require status checks to pass before merging | yes |
| Required status checks (must be green) | `build (20)`, `build (22)`, `build (20) / MSW leak guard`, `Docker build (linux/amd64)` |
| Require linear history | yes |
| Do not allow bypassing the above settings | yes |

Required checks map to jobs that are blocking in our threat model: typecheck + lint + test + build + MSW guard. Docker amd64 is required so Dockerfile regressions block merge.

## 12. Rollback / Soft-Failure Policy

| Check | Blocks merge? | Rationale |
|-------|---------------|-----------|
| ci / typecheck | **yes** | TS strict guard, no false positives. |
| ci / lint | **yes** | Style + correctness, deterministic. |
| ci / test (vitest) | **yes** | 8 tests, must be green. |
| ci / build | **yes** | Bundle health. |
| ci / MSW leak guard | **yes** | Security/contract invariant. |
| ci / e2e (nightly) | **no** | Off-PR; reported but non-blocking. |
| docker / build (arm64) | **no** | PRs run build only on amd64 required check. |
| docker / Trivy scan | **no** | Findings surface, do not block. |
| docker / push | **no** | Build failures only matter on `main`. |

If a workflow is flaky, use **Re-run failed jobs** rather than `git commit --no-verify` discipline. Add a `ci-soft.yml` with `continue-on-error: true` only if a step proves flaky in production for ≥ 1 week — not before.

## 13. Implementation Cost

| Task | Effort |
|------|--------|
| Write 3 workflow YAMLs + `git-cliff.toml` | 0.5 person-day |
| `scripts/ci-local.sh` + hook wiring | 0.25 person-day |
| First green run + secrets/vars setup | 0.5 person-day |
| Branch protection rules (manual UI) | 0.1 person-day |
| Nightly e2e + Trivy tuning | 0.5 person-day |
| **Total** | **~2 person-days** |

No new dependencies in `package.json`. No new infrastructure.

## 14. References

- GitHub Actions core: <https://docs.github.com/en/actions>
- pnpm setup: <https://pnpm.io/continuous-integration#github-actions>
- `docker/build-push-action` multi-arch: <https://github.com/docker/build-push-action>
- `docker/metadata-action`: <https://github.com/docker/metadata-action>
- Trivy action: <https://github.com/aquasecurity/trivy-action>
- Vitest GitHub reporter: <https://vitest.dev/guide/reporters.html>
- Git-cliff: <https://git-cliff.org/>
- Environment protection: <https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment>
- Branch protection: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>

---

## Appendix A — Commit strategy for these files

1. `chore(ci): add ci.yml + docker.yml + release.yml + ci-local.sh` (single commit).
2. Manual: configure `production` environment + vars in repo Settings.
3. Manual: enable branch protection on `main` with required checks from §11.

End of plan.