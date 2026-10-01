# ADR 0037: Web app hosted on Cloudflare Workers

- **Status:** decision (D65, user-approved on 2026-09-27; local Netlify → Cloudflare migration implemented and validated on 2026-09-28; managed cutover pending, with approval for each cloud step)
- **Date:** 2026-09-28
- **Revised:** 2026-09-29
- **Scope:** where and how `apps/web` (TanStack Start SSR, server functions and the `/api/auth` proxy) is built, configured and deployed
- **Update when:** the web host, the Worker layout, the client-IP source, the security-policy mode, server-side error reporting or the deploy path changes
- **Supersedes:** ADR 0029's "Netlify hosts TanStack Start SSR only". The rest of that bullet (no GraphQL, generic patches, dual writes or compatibility database layer) stands.
- **Evidence:** the [D65 feasibility record](../validation/phase-08-2/d65-cloudflare-web-hosting-2026-09-28.md), including its local prototype section

## Implementation status — 2026-09-29

The local source builds and serves TanStack Start through the Cloudflare Vite plugin, a web Worker
entry and Workers Static Assets. The manual deploy workflow is present and Netlify runtime code is
removed. Managed hostnames, secrets/origins, deployment and the staging CPU, Sentry and client-IP
proofs remain in the [hosting runbook](../runbooks/web-worker-hosting.md). Local validation does not
establish a hosted cutover.

## Context

Netlify's free plan meters deploys and bandwidth in credits (Q16), which would limit a free launch.
The session Worker, the room and R2 already run on Cloudflare, where static assets are free and
unmetered. TanStack Start is an officially supported Workers target. The D65 record found the change
small, with conditions C1–C6 on CPU, headers, Sentry and the client IP.

## Decision

1. **Host.** The web app is its own Worker, `artificer-web` (`artificer-web-staging` for staging), in
   the same account and zone as the session Worker but never merged with it: a web deploy or
   rollback must not touch the live room, and a Worker cannot roll back across a Durable Object
   change. It needs no bindings.
2. **Build.** `@cloudflare/vite-plugin` builds the SSR environment into the Worker (`src/server.ts`)
   and the client into Workers Static Assets. `apps/web/wrangler.jsonc` sets `nodejs_compat`,
   `workers_dev: false` and `preview_urls: false`, and declares the required secrets
   `AUTH_PROXY_SECRET` and `CONVEX_SITE_URL`. `public/_headers` gives hashed `/assets/*` immutable
   caching and `nosniff` on every asset; Worker responses keep `withSecurityHeaders`.
3. **Client IP.** The `/api/auth` proxy signs the IP from `CF-Connecting-IP` into its proxy context
   and strips that header, like every other client IP header, before forwarding. A request without it
   fails closed in every build mode; there is no loopback fallback, because local `workerd` sets the
   header from the connecting socket.
4. **Security policy mode.** CSP relaxations (`'unsafe-eval'`, loopback Convex, media and session
   Worker origins) apply only when Vite's build mode is exactly `development`. Vite inlines the mode,
   so the Worker never depends on a runtime `NODE_ENV`, and any other mode (production, staging,
   test) gets the production policy.
5. **Server errors.** The Worker reports to Sentry through `@sentry/cloudflare`'s `withSentry`, with
   the same privacy options as the browser. Request and server-function middleware capture the errors
   TanStack Start turns into responses. The browser keeps `@sentry/tanstackstart-react`. `vite build`
   fails if any Worker chunk includes `@sentry/node` or `@sentry/node-core`, which do not run on
   `workerd` (getsentry/sentry-javascript#20038).
6. **Deploys are manual.** Only the `workflow_dispatch` workflow `Deploy web Worker` deploys, from a
   Linux runner, with per-environment GitHub secrets. Workers Builds' Git integration stays
   disconnected. Staging is a named Wrangler environment on a stable hostname; version preview URLs
   are not used, because Better Auth trusts exactly one origin (`SITE_URL`).
7. **Retire the Netlify application runtime.** The product is pre-launch, so the Netlify plugin,
   functions, tests, patches, configuration and CLI are removed, and the native boundary audit bans
   them. The existing hosted Netlify site and environment are retained only for first-release-cycle
   DNS rollback, then retired with approval, as the hosting runbook specifies.

## Consequences

- The free Workers plan applies: 10 ms CPU per request and one 100,000-request daily pool shared
  with the session Worker. Whether signed-in SSR fits is condition C2, measured on staging only
  (Miniflare does not enforce CPU). If it fails, the D65 record's option A (`ssr: false` on
  `_authed`) is the recommended fallback; Q20 holds that choice.
- `CF-Connecting-IP` must be proven not client-spoofable on the custom domain (C4, staging).
- Local dev and preview run the server in `workerd`, so Node-only APIs fail locally rather than in
  production. `vite.config.ts` copies the root env file's `CONVEX_SITE_URL` and `AUTH_PROXY_SECRET`
  into the process environment, where the Worker's declared secrets are read.
- vanilla-extract externalizes its runtime for Node SSR, which Workers forbid
  (vanilla-extract-css/vanilla-extract#1603); `vite.config.ts` bundles it instead. Remove that
  plugin when upstream stops setting `ssr.external`.
- Rollback within Cloudflare is `wrangler rollback` or the dashboard, to any of the last 100 versions.

## Verification

`src/server/auth/convex.server.test.ts` (IP source and fail-closed path),
`src/server/securityHeaders.test.ts` (production policy whatever `NODE_ENV` is),
`src/observability/sentry.server.test.ts`, the build-time bundle guard in `vite.config.ts`, and the
local `workerd` proof in the D65 record. The user-owned cloud steps are in the
[web Worker hosting runbook](../runbooks/web-worker-hosting.md).
