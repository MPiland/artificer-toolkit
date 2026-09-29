# Web Worker hosting

> **Status:** current for the web app on Cloudflare Workers ([ADR 0037](../adr/0037-web-app-on-cloudflare-workers.md)).
> **Update when:** the Worker configuration, deploy workflow, secrets, hostnames or rollback path changes.
> **Verification:** `apps/web/wrangler.jsonc`, `.github/workflows/deploy-web.yml`, and the local proof in the [D65 record](../validation/phase-08-2/d65-cloudflare-web-hosting-2026-09-28.md).

The web app is the Worker `artificer-web` (staging: `artificer-web-staging`). It serves SSR, server
functions and the `/api/auth` proxy; hashed assets are Workers Static Assets and never invoke it.

## Local

Both commands run the server in `workerd` against the local Docker Convex backend. The root env file
supplies `VITE_CONVEX_URL`, `CONVEX_SITE_URL` and `AUTH_PROXY_SECRET`; the last must match the local
Convex deployment's value.

```text
yarn workspace @artificer-toolkit/web dev              # development build mode
yarn build:web && yarn workspace @artificer-toolkit/web preview   # production build in workerd
```

`vite build` writes `dist/client` (assets, `_headers`), `dist/server` (the Worker and its generated
`wrangler.json`) and, when the process environment holds the declared secrets, `dist/server/.dev.vars`
for `vite preview`. `dist` is ignored; `wrangler deploy` never uploads `.dev.vars`.

The production build's CSP drops HTTP loopback origins, so a browser cannot reach local Convex from a
`vite preview` page; use `dev` for browser journeys and `preview` for header, SSR and proxy checks.

## What the user must do

Agents never run these steps; each cloud step needs the user's explicit approval.

1. **Cloudflare credentials.** Run `wrangler login` for local use, or create a scoped API token with
   _Account → Workers Scripts: Edit_ and _Zone → Workers Routes: Edit_ for `artificertoolkit.app`
   (add _Zone → DNS: Edit_ only if Wrangler must create custom-domain records).
2. **GitHub.** Create the environments `web-staging` and `web-production` (add required reviewers to
   production). In each, add:
   - secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and optionally `SENTRY_AUTH_TOKEN`;
   - variables `VITE_CONVEX_URL`, `VITE_LIVE_SESSION_WEBSOCKET_URL` (`wss://tabletop-staging…` or
     `wss://tabletop…`), `VITE_MEDIA_STORAGE_ORIGIN`, and optionally `VITE_SENTRY_DSN`, `SENTRY_ORG`
     and `SENTRY_PROJECT`.
3. **Worker secrets**, once per environment, typed at the prompt so no value reaches a shell history:
   `wrangler secret put AUTH_PROXY_SECRET --env staging` and `wrangler secret put CONVEX_SITE_URL
--env staging` (omit `--env` for production). `AUTH_PROXY_SECRET` must equal that Convex
   deployment's value; `CONVEX_SITE_URL` is its `https://<deployment>.convex.site` origin.
4. **Hostnames and DNS.** Choose the staging and production web hostnames and commit them to
   `apps/web/wrangler.jsonc` as `routes` with `"custom_domain": true` (as the session Worker does), so
   deploys stay reproducible. Before the production cutover, record the Netlify deploy ID, then delete
   the DNS record that points the production hostname at Netlify: a Custom Domain cannot be created
   over an existing CNAME. The first deploy then creates the record and certificate. `www` and the
   apex are separate hostnames; redirect the non-canonical one with a redirect rule.
5. **Origins that name the web app.** Set the Convex deployment's `SITE_URL` to the web hostname
   (Better Auth trusts only that origin; agents never touch cloud Convex, ADR 0035). Set the session
   Worker's `LIVE_SESSION_ALLOWED_ORIGINS` for that environment to the same origin; the staging value
   is no longer in `apps/session-worker/wrangler.jsonc` because it named a Netlify preview.
6. **Bot protection.** Enable the free Bot Fight Mode (or WAF rules) on the web hostname and choose
   the daily-limit fail mode (Q20). The 100,000-request daily pool is shared with the live room.

## Deploy

Run **Actions → Deploy web Worker → Run workflow** and pick `staging` or `production`. The workflow
builds on Linux with `CLOUDFLARE_ENV` set for staging and runs `wrangler deploy` on the emitted
configuration, tagging the version with the commit SHA. It never runs on push.

## Gates before production (D65)

- **C2:** read per-invocation CPU and wall time in Workers Logs across the staging smoke and V15. p75
  SSR CPU must be at most 10 ms with no "exceeded CPU" errors; otherwise choose Q20 option A or D.
- **C3:** trigger one server error on staging and confirm Sentry receives it from `@sentry/cloudflare`.
- **C4:** send a forged `CF-Connecting-IP` to the staging hostname and confirm Convex's rate limiter
  sees the real client IP.

## Rollback

Within Cloudflare: `wrangler rollback` (or the dashboard) to any of the last 100 versions. Back to
Netlify during the first release cycle: detach the custom domain and restore the recorded DNS
record; keep the Netlify site and its environment until then, and delete them only with approval.
