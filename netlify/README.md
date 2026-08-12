# Netlify backend

`functions/` contains server-only endpoints deployed with the Netlify project. These endpoints are independent of any web or native client; clients initiate product flows through their public APIs, while providers call these endpoints directly.

`send-auth-email.mts` receives Supabase Auth's signed Send Email Hook, delegates verification and rendering to `@artificer-toolkit/emails`, and delivers through Resend. Its production URL is `https://<your-domain>/.netlify/functions/send-auth-email`.

`dispatch-notifications.mts` is the Phase 05 scheduled dispatcher. It runs every minute, reclaims leases older than five minutes, and claims at most 10 due `notification_delivery_intents` per run. It triggers or cancels the four fixed Novu workflows and records bounded delivery, retry, or terminal failure metadata. Logs contain aggregate counts only. This is a small transactional-outbox dispatcher, not a general queue or a local notification inbox.

`novu.mts` is the public Novu Framework Bridge at `https://<deployment>/.netlify/functions/novu`. It supplies the four code-first workflows and renders their `packages/emails` React Email content for the Resend email steps. It must be reachable by Novu Cloud; it is not a browser or product-data API.

Set `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`, `SITE_URL`, and `SUPABASE_URL` as server-only environment variables in Netlify. `SITE_URL` is the canonical public app origin used to validate authentication email redirects. Never prefix these values with `VITE_`.

Product notifications also require `DATABASE_CONNECTION_STRING`, `NOVU_SECRET_KEY`, and `NOVU_APPLICATION_IDENTIFIER`. The secret key is server-only. The application identifier is returned to an authenticated browser only through the recipient-scoped notifications session; neither value belongs in a `VITE_` variable. Resend delivery for product notifications is configured in Novu rather than through this repository's auth-email function. The existing `RESEND_API_KEY` may also deliver Supabase Auth email through `send-auth-email.mts`; do not revoke it unless Auth is first moved to a replacement key.

Complete the provider setup and operational checks in the [notification delivery runbook](../docs/runbooks/notification-delivery.md) before enabling the production schedule.
