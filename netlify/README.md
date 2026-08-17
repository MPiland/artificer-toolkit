# Netlify backend

`functions/` contains server-only endpoints deployed with the Netlify project. These endpoints are independent of any web or native client; clients initiate product flows through their public APIs, while providers call these endpoints directly.

`send-auth-email.mts` receives Supabase Auth's signed Send Email Hook, delegates verification and rendering to `@artificer-toolkit/emails`, and delivers through Resend. Its production URL is `https://<your-domain>/.netlify/functions/send-auth-email`.

The former product-notification dispatcher and Novu Bridge have moved out of Netlify. Product notification execution now lives under `supabase/functions`; see the [Supabase notification delivery runbook](../docs/runbooks/supabase-notification-delivery.md).

Set `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`, `SITE_URL`, and `SUPABASE_URL` as server-only environment variables in Netlify. `SITE_URL` is the canonical public app origin used to validate authentication email redirects. Never prefix these values with `VITE_`.

`live-session-executor.mts` is the private Durable Object command boundary. Set independent, randomly generated `LIVE_SESSION_TICKET_SECRET` and `LIVE_SESSION_EXECUTOR_SECRET` values of at least 32 bytes in both applicable providers. The browser obtains a 60-second room ticket through the authenticated Campaign-session API; only the Cloudflare Worker may call the executor with `LIVE_SESSION_EXECUTOR_SECRET`. Never expose either value through a `VITE_` variable.

The existing native GoRules Zen evaluator runs inside this on-demand Node function, not inside the Durable Object. Warm module reuse is an optimization only; correctness cannot depend on a warm invocation or an in-memory evaluator cache.

Production deploys must use Netlify's connected Git build on Linux. Do not publish this project with `netlify deploy` from Windows: manual deploys package the Windows GoRules binding and absolute Windows Yarn-workspace symlinks, which cannot run in Netlify Functions. Keep function tests under `netlify/tests`; every supported source file placed in `netlify/functions` is treated as a deployable function.

The existing `RESEND_API_KEY` may also deliver Supabase Auth email through `send-auth-email.mts`; do not revoke it unless Auth is first moved to a replacement key.
