#!/usr/bin/env bash
# scripts/ci-local.sh — mirror CI gate locally. Run before `git commit`.
# Mirrors the steps in .github/workflows/ci.yml so failures match what
# GitHub Actions would report. Exit 0 = all green, 1 = any failure.

set -euo pipefail

# Resolve repo root (this script lives in scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

step() { echo; echo "==> $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

step "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

step "pnpm typecheck"
pnpm typecheck

step "pnpm lint"
pnpm lint

step "pnpm test"
pnpm test

step "pnpm test:coverage"
pnpm test:coverage

step "pnpm build"
pnpm build

step "MSW leak guard (dist/ must not contain mockServiceWorker)"
# Catch the file by name — grep flavor (GNU/BSD/ugrep) varies across hosts
# and not all match the filename automatically.
if find dist/ -name 'mockServiceWorker*' -print -quit 2>/dev/null | grep -q .; then
  echo "Leaked files:" >&2
  find dist/ -name 'mockServiceWorker*' >&2
  fail "mockServiceWorker found in dist/ — MSW must not leak into production"
fi

echo
echo "==> ALL CI GATES PASSED"