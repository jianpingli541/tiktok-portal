# API Contract Reference

This portal targets the public TIKTON API. Contract version: **v1** (frozen 2026-06-27).

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/auth/register` | POST | Register a new account |
| `/v1/auth/login` | POST | Sign in (returns session) |
| `/v1/auth/refresh` | POST | Refresh access token |
| `/v1/auth/logout` | POST | Invalidate session |
| `/v1/auth/forgot-password` | POST | Request password reset |
| `/v1/plans` | GET | List pricing plans |
| `/v1/subscriptions/current` | GET | Current subscription |
| `/v1/subscriptions/upgrade` | POST | Upgrade/downgrade plan (legacy mock path, kept for `VITE_STRIPE_ENABLED=false`) |
| `/v1/billing/checkout-session` | POST | Create Stripe Checkout Session, returns hosted `url` |
| `/v1/billing/return` | GET | Look up Checkout Session result for success page (`?session_id=...`) |
| `/v1/tasks` | GET | Paginated task list |
| `/v1/tasks` | POST | Submit new task |
| `/v1/tasks/{id}` | GET | Task detail |
| `/v1/tasks/{id}/cancel` | POST | Cancel running task |
| `/v1/tasks/{id}/retry` | POST | Retry failed task |
| `/v1/auth/delete-data` | POST | GDPR Article 17 — schedule account + data deletion (returns `202`) |

## Auth header

`Authorization: Bearer <access_token>` for all endpoints except `register`, `login`, `forgot-password`, `plans`.

## Error shape

```json
{ "code": "QUOTA_EXCEEDED", "message": "Monthly quota used", "upgrade_url": "/billing" }
```

Status codes: 400 validation, 401 unauthenticated, 402 quota exceeded, 429 rate-limited, 5xx server error.

## Stripe Checkout (added 2026-06-28)

These endpoints back the hosted Checkout flow enabled by `VITE_STRIPE_ENABLED=true`. The portal redirects the browser to `session.url`; the backend receives the actual subscription state change via the Stripe webhook (`/v1/webhooks/stripe`, out of scope for this contract).

### `POST /v1/billing/checkout-session`

Request:
```json
{ "plan_id": "pro_monthly", "success_path": "/billing/return", "cancel_path": "/billing" }
```

Response `200`:
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_...", "session_id": "cs_test_..." }
```

Errors:
- `401` UNAUTHENTICATED
- `402` QUOTA_EXCEEDED (already on a higher tier)
- `409` PLAN_NOT_FOUND
- `429` RATE_LIMITED

### `GET /v1/billing/return?session_id=cs_test_...`

Display-only lookup for the `/billing/return` page. Not the source of truth — the webhook is.

Response `200`:
```json
{
  "payment_status": "paid",
  "subscription": { "plan_id": "pro_monthly", "status": "active", "current_period_end": "2026-07-28T..." }
}
```

`payment_status` is one of `paid`, `unpaid`, `no_payment_required`.

Errors:
- `401` UNAUTHENTICATED
- `402` PAYMENT_FAILED
- `404` SESSION_NOT_FOUND (expired or unknown session)

## GDPR data deletion (added 2026-06-28)

Backed by GDPR Article 17 (right to erasure). The portal exposes a confirmation flow on `/account/delete-data`; the actual erasure is scheduled by the backend and executed within the legally required window (default 30 days).

### `POST /v1/auth/delete-data`

Request:
```json
{ "confirmation_email": "user@example.com" }
```

Response `202`:
```json
{ "request_id": "dlt_01H...", "scheduled_for": "2026-07-28T12:00:00Z" }
```

Errors:
- `400` VALIDATION_FAILED (`confirmation_email` missing/invalid or mismatching the account email)
- `401` UNAUTHENTICATED
- `409` DELETION_ALREADY_PENDING (a request for this account is already in flight)
- `429` RATE_LIMITED

Behavior:
- `202` is returned synchronously even though erasure happens asynchronously. The portal surfaces `scheduled_for` on the confirmation screen and emails the user at each step.
- The `request_id` is opaque and may be referenced in support tickets.
- After `scheduled_for`, the access tokens issued before the request are invalidated and sign-in is blocked.