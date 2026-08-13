# Netlify backend

`functions/` contains server-only endpoints deployed with the Netlify project. These endpoints are independent of any web or native client; clients initiate product flows through their public APIs, while providers call these endpoints directly.

`send-auth-email.mts` receives Supabase Auth's signed Send Email Hook, delegates verification and rendering to `@artificer-toolkit/emails`, and delivers through Resend. Its production URL is `https://<your-domain>/.netlify/functions/send-auth-email`.

The former product-notification dispatcher and Novu Bridge have moved out of Netlify. Product notification execution now lives under `supabase/functions`; see the [Supabase notification delivery runbook](../docs/runbooks/supabase-notification-delivery.md).

Set `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`, `SITE_URL`, and `SUPABASE_URL` as server-only environment variables in Netlify. `SITE_URL` is the canonical public app origin used to validate authentication email redirects. Never prefix these values with `VITE_`.

The existing `RESEND_API_KEY` may also deliver Supabase Auth email through `send-auth-email.mts`; do not revoke it unless Auth is first moved to a replacement key.
