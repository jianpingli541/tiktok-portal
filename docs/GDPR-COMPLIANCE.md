# GDPR Compliance — Implementation Record

This document records how TIKTON Portal implements GDPR-aligned controls
(consent management, legal pages, data-deletion flow) and what remains a
**legal-review** item before public launch.

Implementation date: **2026-06-28**
Scope: Portal front-end only. The backend (TIKTON orchestrator / API) is the
data controller and processor; this file documents only what the portal
enforces and exposes.

---

## 1. Consent management

### What the user sees
- First visit: a non-blocking **Cookie Banner** at the bottom of the page
  with three actions: *Accept all*, *Reject all*, *Customize*.
- Expanded view exposes three categories: **Necessary** (always on),
  **Analytics** (opt-in), **Marketing** (opt-in, currently unused).
- The banner disappears once the user makes a choice.
- Users can re-open preferences from the **Footer → Cookie preferences**
  link on every page, and from the dedicated section on `/privacy`.

### Storage
- Source of truth: `localStorage["tiktok-portal-consent"]` — JSON
  `{ necessary: true, analytics: bool, marketing: bool, decidedAt: ISO8601|null }`.
- Mirror: `js-cookie` cookie `tiktok-portal-consent` (1 year, SameSite=Lax,
  path `/`) — readable server-side for any future server-rendered consent
  gate.

### Defaults before consent (`decidedAt === null`)
- `necessary = true` (session cannot work without it)
- `analytics = false`
- `marketing = false`

This satisfies GDPR Article 7 / recital 32 ("no implicit consent").

### Observability gating
`src/lib/observability.ts` builds Sentry init options from the consent state:

| Consent                     | `tracesSampleRate` | `replaysOnErrorSampleRate` |
|-----------------------------|--------------------|-----------------------------|
| Undecided                   | 0                  | 0                           |
| `analytics = false`         | 0                  | 0                           |
| `analytics = true`, prod    | 0.1                | 0.1                         |
| `analytics = true`, dev     | 1.0                | 1.0                         |
| `marketing = true`          | 0 (reserved)       | 0 (reserved)                |

`reinitObservability(consent)` re-runs Sentry init whenever the user
changes their preferences, so the gate takes effect immediately. The
existing `beforeSend` scrubber (auth headers, cookies, `password`,
`token`, `email`, `ip_address`) is unchanged and still applies.

---

## 2. Legal pages

| Route        | Component                  | Audience | Notes                             |
|--------------|----------------------------|----------|-----------------------------------|
| `/privacy`   | `src/app/(legal)/Privacy.tsx`  | Public  | Includes ConsentPreferences       |
| `/terms`     | `src/app/(legal)/Terms.tsx`    | Public  | Marked `[TODO: legal review]`     |
| `/refund`    | `src/app/(legal)/Refund.tsx`   | Public  | Marked `[TODO: legal review]`     |
| `/account/delete-data` | `src/app/(legal)/DataDeletion.tsx` | Authed | Calls `POST /v1/auth/delete-data` |

The Footer in both AppShell (authenticated) and the public Layout renders
links to the three public pages plus the Cookie Preferences re-opener.

---

## 3. Data deletion flow

`/account/delete-data` is mounted under `<RequireAuth />` — anonymous
visitors are redirected to `/login`.

1. User re-enters their account email; the form refuses submission unless
   it matches `session.user.email`.
2. On submit: `POST /v1/auth/delete-data` with
   `{ confirmation_email: <user-typed-email> }`.
3. Success (`202`): render the request id and `scheduled_for` timestamp,
   and an explanation that the erasure runs within 30 days.
4. Failure: surface the API error message in red beneath the form.

The endpoint contract is documented in
[`docs/API-CONTRACT.md`](./API-CONTRACT.md) under the
*GDPR data deletion* section.

---

## 4. What is intentionally NOT in this PR

- **DPIA / Article 30 record of processing** — owned by the data
  controller (orchestrator team).
- **Data Processing Agreement** with sub-processors — owned by Legal.
- **Cross-border transfer mechanism** (SCCs for Stripe/Sentry) — owned by
  Legal.
- **DSAR intake form beyond deletion** (access / portability): the
  deletion page is a hard GDPR obligation; access / portability are
  routed to `privacy@tikton.example` per the Privacy page.

---

## 5. Legal review checklist (before public launch)

- [ ] Replace `[TODO: legal review]` placeholder in `/terms` with the
      reviewed copy from Legal.
- [ ] Same for `/refund`.
- [ ] Confirm Stripe DPA is on file and linkable from `/privacy`.
- [ ] Confirm Sentry DPA is on file and linkable from `/privacy`.
- [ ] Confirm `privacy@tikton.example` and `support@tikton.example`
      mailboxes route to a real team.
- [ ] Confirm the 30-day erasure SLA in `/account/delete-data` matches
      the orchestrator's actual scheduling window.
- [ ] Add a Cookie Policy page (or expand `/privacy` § "Cookies") that
      lists every first- and third-party cookie set by the portal.
- [ ] Confirm the analytics toggle in `src/lib/observability.ts` matches
      what Sentry's sub-processor list says will be sent.
- [ ] Add a banner / modal announcing the changes for users with
      `decidedAt !== null` and a consent older than 12 months.
- [ ] Add the cookie consent state to the user's data export (DSAR
      portability request).
