# TIKTON Portal — Production Deployment Guide

> Single source of truth for going live. Mirrors `GO-LIVE-REPORT.md §四`
> but as an operational runbook, not a status snapshot.

## 0. Prerequisites

- GitHub `production` Environment created (Settings → Environments → New)
- Stripe HK/SG entity registered + live `pk_live_*` key issued
- Sentry project created + DSN issued
- Production domain + DNS configured (e.g. `portal.tiktok-portal.com`)
- HTTPS certificate (Let's Encrypt via nginx-proxy or Cloudflare)

## 1. GitHub `production` Environment — secrets

Go to **Settings → Environments → production → Add secret**:

| Secret | Purpose | Required |
|---|---|---|
| `VITE_API_BASE_URL` | Public TIKTON API base URL (HTTPS) | yes |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` from Stripe dashboard | yes |
| `VITE_SENTRY_DSN` | `https://<key>@<org>.ingest.sentry.io/<id>` | yes |

And **variables** (not secrets — non-sensitive, can appear in logs):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_ENABLE_MOCK` | `false` | hard-coded; must be false in production |
| `VITE_SENTRY_ENABLED` | `true` | flip off in production for a quiet launch |
| `VITE_SENTRY_ENVIRONMENT` | `production` | shows up in Sentry dashboard |
| `VITE_STRIPE_ENABLED` | `true` | flip false if Stripe not ready |

## 2. Branch protection (recommended)

```bash
# Via gh CLI (replace org/repo)
gh api -X PUT repos/jianpingli541/tiktok-portal/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / build (22)", "Docker / build & push multi-arch image"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
JSON
```

Or do it via the UI: **Settings → Branches → Add rule** for `main`.

## 3. Release flow

```bash
# 1. Tag the commit you want to ship
git tag -a v0.1.1 -m "v0.1.1 — fix billing redirect"
git push origin v0.1.1

# Triggers:
#   - .github/workflows/release.yml → builds + CHANGELOG.md + GitHub Release
#   - .github/workflows/docker.yml  → builds multi-arch image + pushes to ghcr.io
#   - The image carries tag :v0.1.1 (and :v0.1, :latest, :sha-<7>)
```

## 4. Deploy the image

The image is published at:

```
ghcr.io/jianpingli541/tiktok-portal:v0.1.0
ghcr.io/jianpingli541/tiktok-portal:v0.1
ghcr.io/jianpingli541/tiktok-portal:latest
ghcr.io/jianpingli541/tiktok-portal:main
ghcr.io/jianpingli541/tiktok-portal:sha-<git-sha>
```

`latest` is only updated from the `main` branch (default-branch rule in
`docker.yml`'s metadata-action). Tag-driven releases get their own
`semver` tags.

### On the production server

```bash
# Pull the specific tag you want to ship
docker pull ghcr.io/jianpingli541/tiktok-portal:v0.1.0

# Run it (port 8080, restart on failure, health check built-in)
docker run -d \
  --name tiktok-portal \
  --restart unless-stopped \
  -p 80:8080 \
  ghcr.io/jianpingli541/tiktok-portal:v0.1.0

# Verify
curl http://localhost/healthz   # → ok
curl -o /dev/null -w '%{http_code}\n' http://localhost/   # → 200
```

### Behind nginx (HTTPS termination)

Reverse-proxy nginx in front, terminate TLS, proxy to the container on `:8080`:

```nginx
server {
    listen 443 ssl http2;
    server_name portal.tiktok-portal.com;

    ssl_certificate     /etc/letsencrypt/live/portal.tiktok-portal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.tiktok-portal.com/privkey.pem;

    # HSTS, security headers, etc. — see Mozilla SSL config generator.

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. Rollback

```bash
# Roll back to a previous tag (image is content-addressed, no DB to migrate)
docker pull ghcr.io/jianpingli541/tiktok-portal:v0.1.0
docker stop tiktok-portal && docker rm tiktok-portal
docker run -d --name tiktok-portal --restart unless-stopped -p 80:8080 \
  ghcr.io/jianpingli541/tiktok-portal:v0.1.0
```

The container is stateless — no DB, no local volume. Rollback is just
"pull the previous tag, restart."

## 6. Monitoring

- **Health probe**: `GET /healthz` (the container itself; or via your
  load balancer's HTTP health check on `/`)
- **Errors**: Sentry dashboard, project filter `environment: production`
- **Uptime**: any HTTP monitor on `/healthz` (UptimeRobot, BetterStack, etc.)

## 7. Cookie consent + legal pages

Cookie consent banner is shown to all first-time visitors. State is
stored in localStorage and propagates to Sentry sampling. The four
legal pages (`/privacy`, `/terms`, `/refund`, `/data-deletion`) are
linked from the Footer. The `/data-deletion` page posts to
`POST /v1/auth/delete-data` — backend must implement that endpoint
and schedule the actual purge 30 days out.

## 8. Backend dependencies (TIKTON orchestrator)

The frontend expects these endpoints to exist (see `docs/API-CONTRACT.md`):

| Endpoint | Status | Owner |
|---|---|---|
| `POST /v1/billing/checkout-session` | must implement | orchestrator |
| `GET /v1/billing/return` | must implement | orchestrator |
| `POST /v1/auth/delete-data` | must implement | orchestrator |
| Stripe webhook handler | must implement | orchestrator |

All other endpoints (`/v1/auth/*`, `/v1/tasks`, `/v1/plans`,
`/v1/subscriptions/current`) are already in production per the
existing v1 contract.

## 9. CI / CD sanity checklist

- [x] `pnpm typecheck` — green
- [x] `pnpm lint` — green
- [x] `pnpm test:coverage` — green (70/60 threshold)
- [x] `pnpm build` — green, no MSW leakage
- [x] `docker build` (multi-arch) — green
- [x] `docker run` + `/healthz` — green
- [x] Release workflow — green, GH Release v0.1.0 published
- [ ] Branch protection ruleset — apply via §2 above
- [ ] `production` Environment secrets — apply via §1 above
- [ ] DNS + HTTPS — server ops