# Netlify backend

`functions/` contains server-only endpoints deployed with the Netlify project. These endpoints are independent of any web or native client; clients initiate product flows through their public APIs, while providers call these endpoints directly.

`send-auth-email.mts` receives Supabase Auth's signed Send Email Hook, delegates verification and rendering to `@artificer-toolkit/emails`, and delivers through Resend. Its production URL is `https://<your-domain>/.netlify/functions/send-auth-email`.

Set `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`, and `SUPABASE_URL` as server-only environment variables in Netlify. Never prefix them with `VITE_`.
