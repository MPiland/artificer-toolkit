# D65: moving the web app from Netlify to Cloudflare Workers, 2026-09-28

**Status:** research for [D65](../../handoffs/phase-08-2-open-questions.md) ("Before moving"), then
the local prototype (plan steps 1–3, [below](#local-prototype-steps-13-2026-09-28)) under
[ADR 0037](../../adr/0037-web-app-on-cloudflare-workers.md). No cloud account or deployment was
touched. It is not acceptance evidence, and the ledger is unchanged.

**Recommendation: go with conditions.** TanStack Start is an officially supported Cloudflare target,
and this app needs only a small, well-bounded set of code changes. The request budget fits Workers
Free with wide headroom at the Q16 load. What is not proven is the 10 ms CPU limit for authenticated
SSR pages, and the server-side Sentry SDK on `workerd`. Both must pass a measured gate on a staging
Worker before production moves (conditions C1–C6 below). If the CPU gate fails, the recommended
fallback is to stop server-rendering the signed-in app (`ssr: false` on `_authed`), not Workers Paid.

## Method

- **Repository, at `db741c59d`:** `apps/web` build config, server entry, auth proxy, security headers,
  router, root and `_authed` routes; every `netlify` reference in the repo; `.github/workflows`; the
  session Worker's `wrangler.jsonc`; ADR 0029, ADR 0036 and the ADR 0035 S0 budget.
- **Installed versions:** `@tanstack/react-start` 1.167.65 (`start-plugin-core` 1.169.20), Vite 8.2.1,
  `@netlify/vite-plugin-tanstack-start` 1.3.17, `@sentry/tanstackstart-react` 10.67.0, `better-auth`
  1.6.15, `wrangler` 4.123.0. `@cloudflare/vite-plugin` is not installed.
- **CPU spike (local, anonymous only):** `local-validation/d65-cloudflare-web/ssr-cpu.mjs` imports the
  existing production SSR build (`apps/web/dist/server`, built 2026-09-26 by the local pre-staging run)
  in Node 24 and serves requests against the local Docker Convex backend. It supplies the Netlify
  request context itself and uses a throwaway in-process `AUTH_PROXY_SECRET`. CPU is
  `process.cpuUsage()` over 200 warm requests after 60 warm-up requests.
- **Bundle spike:** `local-validation/d65-cloudflare-web/bundle-estimate.mjs` re-bundles that SSR build
  with esbuild 0.28.1, inlining every npm dependency under the `workerd`/`worker` export conditions,
  minified, to estimate the Worker's size and its static import graph.
- **Docs:** checked 2026-09-28 through the Cloudflare documentation search and direct fetches; every
  claim below cites its page.

## 1. Can this TanStack Start version deploy to Workers?

**Yes.** Cloudflare's framework guide and TanStack's hosting guide both document it:
`@cloudflare/vite-plugin` plus `wrangler`, `cloudflare({ viteEnvironment: { name: 'ssr' } })` before
`tanstackStart()`, and a `wrangler.jsonc` whose `main` is the server entry
([Cloudflare guide][cf-tss], [TanStack hosting][tss-hosting], [changelog 2025-10-24][cf-tss-log]).

- **Versions.** The current plugin (1.62.0) peers on `vite ^6.1.0 || ^7.0.0 || ^8.0.0` and
  `wrangler ^4.143.0` ([npm][npm-plugin]). Vite 8.2.1 is fine; the root `wrangler` (4.123.0) must be
  bumped, which also moves the session Worker's tooling. Static prerendering needs
  `@tanstack/react-start` ≥ 1.138.0 ([Cloudflare guide][cf-tss]); 1.167.65 qualifies.
- **Static assets.** The plugin builds the client environment and fills `assets.directory` in the
  generated deploy config automatically, so it uses Workers Static Assets
  ([Vite plugin static assets][cf-vite-assets]). Assets are served first; the Worker runs only when no
  asset matches ([routing][cf-assets-routing]).
- **Node compatibility.** For compatibility dates on or after 2026-08-04, `nodejs_compat` is on by
  default ([Node.js compatibility][cf-node]). `process.env` is populated from vars and secrets for dates
  on or after 2025-04-01 ([environment variables][cf-env]).
- **Size is no longer a concern.** Worker size is 64 MiB uncompressed on both plans, with no compressed
  limit ([limits][cf-limits]). The bundle spike gives 9.1 MB raw minified (2.9 MB gzip), of which only
  1.6 MB is in the entry's static import graph; the rest is lazily imported route code. The largest
  inputs are `@tabler/icons-react`, `three-stdlib`, app code, Rapier, `pixi.js` and `three`, all pulled
  in by SSR route chunks.

**Changes in `apps/web`:**

| Area | Today | On Workers |
| --- | --- | --- |
| `vite.config.ts` | `netlify()` plugin; `loadServerOnlyEnv` copies `CONVEX_SITE_URL` and `AUTH_PROXY_SECRET` from the root `.env` into the Vite process | Replace with `cloudflare({ viteEnvironment: { name: 'ssr' } })`. SSR runs inside `workerd` in dev and preview, so the Vite process's `process.env` no longer reaches it: server variables come from `.dev.vars` or `.env` beside the Worker config, and the loader goes |
| New `apps/web/wrangler.jsonc` | none (`netlify.toml`) | `main: "src/server.ts"` (the existing custom entry), a current `compatibility_date`, `observability.enabled`, `workers_dev: false` and `preview_urls` set deliberately, the production custom domain and a `staging` environment. No bindings are needed |
| `src/server.ts` | `Sentry.wrapFetchWithSentry` from `@sentry/tanstackstart-react` | Wrap with `@sentry/cloudflare`'s `withSentry` per Sentry's Cloudflare guide (see section 2) |
| `src/server/auth/convex.server.ts` | client IP from `getContext().ip` (`@netlify/functions`) | Read `CF-Connecting-IP`; fail closed when absent in production. Without this change every production auth request throws, because the Netlify context store is empty |
| `src/start.ts` | `randomBytes` from `node:crypto` for the CSP nonce | Works under `nodejs_compat`, but `crypto.getRandomValues` removes the Node dependency |
| `public/` | `mockServiceWorker.js`, `zod-csp-bootstrap.js`, icons | Add `_headers` (`/assets/*` immutable caching, `nosniff`); the Worker's `withSecurityHeaders` does not reach asset responses ([headers][cf-headers]) |
| `package.json` | `@netlify/functions`, `@netlify/vite-plugin-tanstack-start` | Remove; add `@cloudflare/vite-plugin`, `@sentry/cloudflare` |

**Netlify code to remove elsewhere** (pre-launch rule: no compatibility shims): `apps/web/netlify.toml`;
`netlify/tests/viteStaticResponse.test.ts` and `netlify/tsconfig.json`; the root resolution and
`.yarn/patches/netlify-vite-plugin-npm-2.12.9-static-response.patch`; `netlify-cli`; the
`lint:ox:type-aware:netlify` script; the `netlify-tests` stage in `scripts/validatePreStagingLocal.mjs`;
the `@netlify/functions` allowance in `scripts/auditNativeBoundaries.mjs` (invert it into a ban);
`vitest.config.ts` (`@netlify/vite-plugin` inline, `netlify/tests`); the `NETLIFY_` filter in
`apps/web/playwright.local-vtt.config.ts`; `.netlify` entries in `.gitignore`, `apps/web/.gitignore`,
`.dockerignore`, `.oxlintrc.jsonc`; the mock in `convex.server.test.ts`; and the staging
`LIVE_SESSION_ALLOWED_ORIGINS` in `apps/session-worker/wrangler.jsonc`, which names a Netlify
deploy-preview origin.

**Docs to update:** ADR 0029 states "Netlify hosts TanStack Start SSR only", which is load-bearing, so
the move needs an ADR (or ADR 0029 amendment) per AGENTS.md. Also `apps/web/README.md` (14 mentions,
including the Netlify release path), `docs/architecture/overview.md`, `docs/README.md`,
`apps/apis/README.md`, the release runbook, and `docs/runbooks/notification-delivery.md`, which still
describes retired Netlify functions.

## 2. SSR, auth, CSP and redirects on Workers

| Piece | Verdict | Notes |
| --- | --- | --- |
| `/api/auth/*` proxy (`handleConvexAuthRequest`) | Works, after the IP change | Standard `Request`/`fetch`/`Headers`; `duplex: 'half'` streaming is accepted. The request is native on Workers, so the `NodeRequest` workaround comment no longer applies |
| Signed proxy context (`signAuthProxyContext`) | Works | `jose` HS256 over WebCrypto |
| Client IP for Convex rate limits | Needs change | Use `CF-Connecting-IP`. Cloudflare documents it as the connecting client's IP, but its [HTTP headers page][cf-headers-ref] does not say outright that a client-sent value is overwritten. Verify with a forged header in C2 |
| SSR session read (`createAuthenticatedConvexClient`) | Works | Two `fetch` subrequests at most plus the `ConvexHttpClient` queries; well under Free's 50 external subrequests per request ([limits][cf-limits]) |
| Better Auth cookies | Expected to work | Cookies are host-scoped; if the production hostname stays the same, existing sessions survive. Multiple `Set-Cookie` headers copied through `new Headers(...)`: verify in C1 that sign-in still sets every cookie |
| Email links (`/api/auth/verify-email`, email change) | Works | They are navigations to `/api/auth/*`, which reach the Worker because no asset matches. Keep it that way: do not enable SPA `not_found_handling` without `run_worker_first` for `/api/auth/*` ([SPA routing][cf-spa]) |
| CSP with per-request nonce (`start.ts`, `securityHeaders.ts`) | Works for SSR responses | **Risk:** `isDevelopment()` is `process.env.NODE_ENV !== 'production'`. If `NODE_ENV` is unset in the Worker, production CSP gains `'unsafe-eval'` and loopback sources, and the auth IP fallback path is taken. C1 must prove `NODE_ENV === 'production'` at runtime (build-time define or a Worker var) |
| Redirects | Nothing to port | `netlify.toml` has no redirects or headers; all redirects are router `redirect()` calls in the Worker |
| Server-side Sentry | **Not proven** | `@sentry/tanstackstart-react` 10.67.0 maps `workerd`/`worker` to `index.server.js`, which re-exports `@sentry/node` (checked in `node_modules`). Sentry issue [#20038][sentry-20038] reports that this breaks Workers ("Cannot initialize ExportedHandler") and was closed as not planned. Sentry's [TanStack Start on Cloudflare guide][sentry-cf-tss] nonetheless imports `wrapFetchWithSentry` from it. The documented workaround is `@sentry/cloudflare` on the server and client-only use of the TanStack package |
| `node:module` `createRequire` | **Not proven** | The current SSR build emits `createRequire(import.meta.url)` in the `richText` chunk to `require('react')` from a CommonJS dependency. Once the plugin bundles everything this may disappear or may need `workerd` support; C1 covers it |
| `node:async_hooks` | Works | `AsyncLocalStorage` is supported under `nodejs_compat` |

## 3. CPU: will SSR fit 10 ms?

**What Cloudflare counts.** Free gives 10 ms CPU per HTTP request; waiting on `fetch` does not count.
Workers that "consistently exceed" it are terminated, with some tolerance for occasional overruns.
Global-scope startup has its own 1 s limit ([limits][cf-limits]).

**Measured (Node 24, this desktop, anonymous pages, warm):**

| Route | HTML | Warm CPU per request |
| --- | --- | --- |
| `/sign-up` | 25 KB | 0.8–2.0 ms |
| `/sign-in` | 29 KB | 2.4–13.6 ms |
| `/reset-password` | 28 KB | 1.0–8.5 ms |
| `/` (landing) | 39 KB | 3.0–11.2 ms |

- The spread is run-to-run noise: `process.cpuUsage()` includes V8's background compiler and GC
  threads, and Windows timer granularity is about 15.6 ms. Treat anonymous pages as **roughly 2–8 ms**.
  Node's JavaScript `fetch` also costs CPU that `workerd`'s native `fetch` does not.
- **Cold:** module load was 1.2–2.0 s and the first render about 1.5 s of CPU. In Node that includes
  resolving hundreds of files from disk, so it overstates `workerd`. But the first request that lazily
  imports a large route chunk (`AuthoringLayout` 0.94 MB, `campaigns` 0.78 MB, `CharacterSheetView`
  0.42 MB, unminified SSR output) will exceed 10 ms in any runtime. At launch traffic most requests may
  land on a cold isolate.
- **Not measured:** signed-in pages. They render the Mantine shell plus the Character sheet, Campaign,
  authoring editor or tabletop tree, and serialize their loader data into the HTML (seroval), after zod
  parsing. By size they are several times the landing page, so **10–40 ms is a plausible range, and
  above 10 ms is likely for the heavy routes.** This is an estimate, not a measurement.

**Can static and prerendered routes bypass the Worker?** Yes for assets: hashed JS, CSS and fonts never
invoke the Worker ([routing][cf-assets-routing]). Prerendered HTML would also be a free asset
([Cloudflare guide][cf-tss]), but only for anonymous pages, and a prerendered page cannot carry a
per-request CSP nonce; it would need hash-based CSP in `_headers`. It is not needed at Q16 volumes.

**If authenticated SSR does not fit, the options are:**

| Option | Worker CPU | Cost | Trade-off |
| --- | --- | --- | --- |
| **A. `ssr: false` on `_authed`** (recommended fallback) | The Worker still renders the root shell and runs the root `beforeLoad` (one session read). That is comparable to `/sign-up`, about 1–2 ms | $0 | Signed-in pages render on the client after hydration. Competing tools are client-rendered apps: Foundry VTT, Owlbear Rodeo and the D&D Beyond builder and sheets. SEO does not apply behind sign-in. It also removes the server-side copies of loader queries (see the risk below) |
| B. `ssr: 'data-only'` on heavy routes | Loaders and serialization stay on the server; only component rendering moves | $0 | Less CPU saved than A, keeps the duplicated Convex reads |
| C. SPA mode with `not_found_handling: single-page-application` | Navigations are served the shell without invoking the Worker ([SPA routing][cf-spa]); the Worker handles only `/api/auth/*` and `/_serverFn/*` via `run_worker_first` | $0 | Loses SSR everywhere, including the landing page; the static shell needs hash-based CSP instead of nonces |
| D. Workers Paid | 30 M CPU-ms a month included, up to 5 min per request | **$5 a month** minimum, with 10 M requests included ([pricing][cf-pricing]) | Keeps full SSR unchanged. Conflicts with the stay-free constraint until revenue, so it is the user's call |

## 4. Request budget

**Facts.** Static asset requests are "free and unlimited" when no Worker runs
([pricing][cf-pricing], [static asset billing][cf-assets-billing]); navigations and `/api/auth/*` invoke
the Worker. The Free 100,000 a day is one pool across the account's Workers: Cloudflare's own example
splits it 50,000 + 50,000 between two products, and it resets at midnight UTC
([Pages Functions pricing][cf-pages-pricing]). WebSocket messages through a Worker are not requests;
only the upgrade is ([pricing][cf-pricing]). Durable Objects have their own 100,000 requests a day
([DO pricing][cf-do-pricing]); whether a Worker-to-DO call also counts against the Workers pool is
not stated there, so this estimate counts the S0 room figure against the Workers pool too
(conservative).

**Per active user, per day** (TanStack navigations after the first load are client-side and do not hit
the Worker; data comes from Convex directly):

| Source | Normal day | Session day (4 h) |
| --- | --- | --- |
| SSR document loads (first visit, reloads, new tabs, the tabletop window) | 5 | 3 |
| `/api/auth/convex/token` at load and every 15 min (the `@convex-dev/better-auth` default JWT lifetime) | 5 + 6 | 3 + 16 |
| `/api/auth/get-session`: at load, and on every tab refocus 5 s or more apart (Better Auth's `refetchOnWindowFocus` defaults to true; the app does not override it) | 5 + ~15 | 3 + ~60 |
| **Total** | **~35–40** | **~85–120** |

**At Q16** (100 users, 20 tables, 80 sessions a month, a 10-session peak day as in S0, 6 members a
table):

| | Average day (2.7 sessions) | Peak day (10 sessions) |
| --- | --- | --- |
| Web, sessions: sessions × 6 × 120 | 1,900 | 7,200 |
| Web, other active users: 40 DAU × 40 | 1,600 | 1,600 |
| Session Worker and room: sessions × 570 (S0 target design, no pointer previews) | 1,500 | 5,700 |
| Content snapshots (ADR 0036): about 40 objects per first Builder load, cached by hash; 50 builds a month | < 100 | < 100 |
| **Total** | **~5,100** | **~14,600** |
| **With Q16's 50% headroom** | ~7,700 (8% of 100k) | ~22,000 (22% of 100k) |

**Verdict: fits.** The risks are the unbounded sources, not the model:
- **Crawlers and scanners.** Every unknown path and 404 is an SSR invocation, and the pool is shared
  with the live room. When the pool runs out, routes fail open or closed, and `run_worker_first`
  requests get 429 ([limits][cf-limits], [static asset billing][cf-assets-billing]). Either way,
  sign-in and WebSocket upgrades stop until midnight UTC.
- **Pointer previews.** S0's measured `POINTER_PREVIEW` traffic is +13,500 to +67,500 room requests per
  session. It must stay fixed (memory-only previews), independent of D65.
- **Focus refetch.** It dominates the web count and also costs Convex calls. Setting
  `sessionOptions.refetchOnWindowFocus: false` is worth considering, since Convex authorizes by JWT and
  the provider refreshes it on its own. That is a behavior change for the user to approve.
- **Preflights.** Private snapshot scopes send an `Authorization` header cross-origin, so each object
  needs a CORS preflight unless `Access-Control-Max-Age` is set. It is still small.

## 5. Same Worker as the session Worker, or separate?

**Recommendation: a separate Worker** (for example `artificer-web`), in the same account and zone.
Content snapshots stay on the session Worker, as ADR 0036 decided.

- **Isolation of the live room.** Bundling 9 MB of SSR code into the Worker that hosts the Durable
  Object would lengthen the room's cold starts and put SSR CPU in the same script. A crash or a bad
  deploy of the web app should never take a table down.
- **Deploy and rollback.** A Worker cannot roll back across a Durable Object class change
  ([rollbacks][cf-rollbacks]). Web releases need to roll back freely and independently.
- **No budget gain from merging.** The daily request pool is per account either way. Proxying snapshots
  through the web origin would add web invocations, not remove them.
- **The web Worker needs no bindings.** It keeps its current shape: SSR plus the `/api/auth` proxy.
- **Cost of separation.** Snapshot reads stay cross-origin (CORS, and preflights for private scopes).
  CSP already allows the session Worker's HTTP and WebSocket origins.

## 6. Migration plan (ordered)

Sequencing: its own slice after ADR 0035 S0, per D65. Steps 1–3 are local; every step from 4 on
touches a cloud account and needs the user's explicit approval each time.

1. **Local prototype (no cloud).** Make the section 1 changes and delete the Netlify code in the same
   slice. Run `vite dev` and `vite preview` (both in `workerd`) against the local Docker Convex
   backend. Prove every auth flow: sign-up, the verification link, sign-in, sign-out, password reset
   OTP, email change, and the SSR session on reload. Check every route family renders, the CSP header
   and nonce, `NODE_ENV`, Sentry initialisation and the `createRequire` chunk.
2. **Docs.** Write the hosting ADR (or ADR 0029 amendment) and update the READMEs, overview and
   release runbook. Add a `workflow_dispatch`-only deploy workflow (see CI below).
3. **Local gates.** Affected typecheck, the web unit tests that cover `convex.server.ts`,
   `securityHeaders.ts` and `start.ts`, and `yarn validate:pre-staging:local` with its Netlify stage
   replaced by a Worker build.
4. **Staging Worker** *(approval)*. Deploy `artificer-web-staging` on a staging custom domain. Set its
   secrets. Point the staging Convex `SITE_URL` and the session Worker's staging
   `LIVE_SESSION_ALLOWED_ORIGINS` at it. Use a stable hostname rather than per-version URLs, because
   Better Auth trusts exactly one origin (`trustedOrigins: [SITE_URL]`).
5. **CPU and header gate on staging** *(approval)*. Run the staging smoke and V15 through it. Read
   per-invocation CPU and wall time in Workers Logs and the Query Builder ([CPU and wall time][cf-cpu-log]).
   Apply conditions C2–C3, and choose option A, B, C or D if C2 fails.
6. **Production** *(approval)*. Record the Netlify deploy ID for rollback. Delete the DNS record that
   points the web hostname at Netlify: a Custom Domain cannot be created on a hostname with an
   existing CNAME. Then attach the Custom Domain, and Cloudflare creates the DNS record and
   certificate. `www` and the apex are separate hostnames, so the one that is not canonical needs a
   redirect rule ([custom domains][cf-custom-domains]). Expect a short gap between the two steps. The
   `artificertoolkit.app` zone is already on Cloudflare, since the session Worker uses custom domains
   on it. Keep the same hostname so cookies, `SITE_URL` and email links are unchanged. Run the R10
   smoke.
7. **Rollback window.** Within Cloudflare: `wrangler rollback` or dashboard rollback to any of the last
   100 versions ([rollbacks][cf-rollbacks]). Back to Netlify: detach the custom domain and restore the
   DNS record, so keep the Netlify site and its environment until one release cycle passes.
8. **Retire Netlify** *(approval)*. Delete the Netlify site, environment and build hook. Update the
   acceptance ledger and open-questions doc.

**Environment variables:**
- *Build time (client), unchanged:* `VITE_CONVEX_URL`, `VITE_LIVE_SESSION_WEBSOCKET_URL`,
  `VITE_MEDIA_STORAGE_ORIGIN`, `VITE_SENTRY_DSN`.
- *Build-only secrets:* `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (source maps).
- *Worker runtime:* `CONVEX_SITE_URL` (var) and `AUTH_PROXY_SECRET` (secret), plus `NODE_ENV=production`
  unless the build defines it. `securityHeaders.ts` reads `process.env.VITE_*` first at runtime; that
  keeps working because vars populate `process.env`.
- *Retired:* `SECRETS_SCAN_OMIT_KEYS` (Netlify-only).

**Preview deploys.** Version URLs run against production resources, and Cloudflare says not to use them
for branch testing ([compare workflows][cf-previews]). Here the Worker has no bindings, but auth still
fails on any origin other than `SITE_URL`. Use the named staging Worker (Wrangler environment) as the
preview target. Per-PR previews would need their own Convex deployment and origin; that is not worth
it pre-launch.

**CI.** `.github/workflows/tests.yml` is manual-only (`workflow_dispatch` or a push to `ci/run`). Keep
deploys equally manual: a `workflow_dispatch` job that builds on Linux and runs `wrangler deploy
--env <staging|production>`, using repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. Do not connect Workers Builds' Git integration, which builds on push and
would contradict the manual-only policy. Building from Windows is technically possible now, since the
native GoRules binding that forced Linux Netlify builds is retired. Linux CI stays the reproducible
release path.

**What the user must do themselves:**
- Approve each cloud step (4–8) and each staging smoke.
- `wrangler login`, or create a scoped API token (Workers Scripts: Edit, and Zone: Workers Routes for
  the zone). Add it and the account ID as GitHub secrets.
- Enter secret values (`wrangler secret put AUTH_PROXY_SECRET`, Sentry tokens). Agents never see them.
- Attach the custom domains and approve removing the Netlify DNS record.
- Change cloud Convex `SITE_URL` if any hostname changes. Agents do not touch cloud Convex (ADR 0035).
- Choose the daily-limit fail mode, and optionally enable the free Bot Fight Mode or WAF rules on the
  web hostname.
- Decide option A–D if the CPU gate fails, and whether to disable Better Auth's focus refetch.
- Delete the Netlify site at retirement.

## Local prototype (steps 1–3), 2026-09-28

The code is on `codex/phase-08-2-convex-cutover` in commits "Build and serve the web app as a
Cloudflare Worker (D65)" through "Fix signed-in SSR in workerd"; the decision is
[ADR 0037](../../adr/0037-web-app-on-cloudflare-workers.md). No cloud account was used.

**Method.** `@cloudflare/vite-plugin` 1.62.0 and Wrangler 4.143.0 (workerd 1.20260926). Two runs
against the local Docker Convex backend (`phase82-local-linux`), with the local application env file
injected by Yarn: a production-mode `vite build` served by `vite preview`, and `vite dev`. Both run
the server in `workerd`. The build used a syntactically valid Sentry DSN on the reserved `.invalid`
TLD, so Sentry initialises and its CSP entry appears but nothing is sent. A Node script drove each
run over HTTP. A verified throwaway account was created through the invitation mutations with the
local admin key generated in memory; no secret, cookie value or password was printed. Evidence is
under the ignored `local-validation/d65-web-worker/` (`proof-*.json`, `netlify-era-csp.json`,
`deploy-dry-run.log`).

| Check                                    | Production build in `workerd`                                                                                                                                                                                             | `vite dev` in `workerd`                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Landing SSR (`/`)                        | 200 ×6; nonce in HTML matches CSP                                                                                                                                                                                         | 200 ×6; dev CSP (`'unsafe-eval'`, loopback origins) |
| Hashed asset (`/assets/index-*.js`)      | 200, `public, max-age=31536000, immutable`, `nosniff`                                                                                                                                                                     | n/a (Vite serves source)                            |
| Sign-up via `/api/auth` proxy            | 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED` (local Convex has public sign-up off), `no-store`                                                                                                                                   | same                                                |
| Sign-in                                  | 200, two `Set-Cookie` (`session_token`, `convex_jwt`) preserved                                                                                                                                                           | same                                                |
| `/api/auth/get-session` with the cookies | 200, the account's session                                                                                                                                                                                                | same                                                |
| Signed-in SSR (`/characters`)            | 200 ×5, renders the username                                                                                                                                                                                              | same                                                |
| Route families, signed in                | `/home`, `/characters`, `/campaigns`, `/backgrounds`, `/classes`, `/creatures`, `/equipment`, `/feats`, `/races`, `/vehicles`, `/systems`, `/notifications`, `/settings/account`: 200; `/social`: 307 to `?view=discover` | same                                                |
| Guest pages                              | `/sign-in`, `/sign-up`, `/reset-password`: 200                                                                                                                                                                            | same                                                |
| Sign-out                                 | 200, four clearing `Set-Cookie`; session then `null`; `/characters` then 307 to `/sign-in`                                                                                                                                | same                                                |

- **Not host-related, since fixed:** `/spells` returned 500 in both runs because its Convex list
  and summary queries reread the System and every referenced Class root once per row and exceeded
  Convex's 16 MiB read limit ("Too many bytes read in a single function execution"). The catalogue
  queries now serve identical reads once per query (`catalogueReadBudget.test.ts`: Spell summary
  37 MB to 1.5 MB, Spell page 4.6 MB to 0.48 MB). `/library` has no index route by design: Library
  is a navigation menu (PRODUCT.md, DESIGN.md) and no link targets it.
- **CSP identical to today's production (C1).** The pre-D65 `securityHeaders.ts`, evaluated with
  `NODE_ENV=production` and the same inlined values, gives byte-identical `Content-Security-Policy`
  (nonce normalised), `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options` and
  `X-Frame-Options`; neither sends HSTS. The Worker no longer reads `NODE_ENV` for policy: in the
  production bundle `isDevelopment()` compiles to `return false`.
- **Found and fixed:** workerd rejects `fetch(..., { redirect: 'error' })`, so every signed-in SSR
  request returned 500 until the session reads switched to `redirect: 'manual'` (a redirect still
  fails closed). vanilla-extract's SSR `external` setting is rejected by the plugin; the runtime is
  now bundled.
- **`createRequire`:** none remains in the Worker output; the plugin bundles the CommonJS dependency.
- **Sentry (C3, local part):** no `@sentry/node` or `@sentry/node-core` module is in any Worker chunk,
  and `vite build` fails if one appears (the guard was checked by pointing it at `@sentry/core`, which
  failed the build). `@sentry/cloudflare` initialises with a DSN in `workerd` without errors. Delivery
  of a captured error is not proven.
- **`CF-Connecting-IP` (C4, local part):** local `workerd` sets it from the socket, so auth works in
  both runs; the proxy strips it before forwarding and fails closed without it (unit tests). Miniflare
  sets the header only when the client did not send one, so spoofing can only be tested at the edge.
- **Size:** `wrangler deploy --dry-run` reports 14,321 KiB (3,416 KiB gzip), under the 64 MiB
  uncompressed limit; the compressed limit was removed on 2026-09-04.
- **CPU:** Wrangler and Miniflare report no per-request CPU, so these are **local wall times, not
  Workers CPU**, and include the round trips to local Convex. Production build: landing 62 ms cold,
  18–35 ms warm; signed-in `/characters` 227 ms first, 95–187 ms after; signed-in list pages
  91–674 ms. `vite dev` adds its optimizer (15 s first request). C2 stays a staging measurement.

| Condition | Local status                                                                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1        | **Proven locally:** auth flows except email links, every list route family, CSP identical, policy independent of `NODE_ENV`. Not covered: the verification link, password-reset OTP and email change (the local sink discards mail), and browser-driven journeys |
| C2        | Not provable locally (no CPU accounting in Miniflare)                                                                                                                                                                                                            |
| C3        | **Partly:** `@sentry/node` provably absent and init works; capture needs staging                                                                                                                                                                                 |
| C4        | **Partly:** fail-closed path proven; non-spoofability needs the custom domain                                                                                                                                                                                    |
| C5        | **Proven locally:** `_headers` served on assets; `workers_dev: false` and `preview_urls: false` in both environments of `wrangler.jsonc` and in the emitted production config                                                                                    |

## Conditions for "go"

- **C1.** The local prototype (step 1) passes all auth flows and route families in `workerd`, with
  `NODE_ENV === 'production'` and CSP identical to today's.
- **C2.** On staging, SSR document requests show p75 CPU ≤ 10 ms, and no "exceeded CPU" errors appear
  across the smoke and V15. Otherwise adopt option A (recommended) or D before production.
- **C3.** Server-side Sentry captures an error from the staging Worker using `@sentry/cloudflare`, or
  server Sentry is disabled until it does. Never ship `@sentry/node` in the Worker.
- **C4.** `CF-Connecting-IP` is proven not client-spoofable on the custom domain (a forged header must
  not reach Convex's rate limiter), and auth fails closed when it is missing.
- **C5.** `_headers` gives `/assets/*` immutable caching and `nosniff`, and `workers_dev` and
  `preview_urls` are off for production.
- **C6.** The pointer-preview fix from S0 has landed (the shared request pool).

## Risks

- Authenticated SSR over 10 ms (likely for heavy routes), and cold isolates paying lazy chunk
  compilation inside the request. Covered by C2 and option A.
- The Sentry server SDK on `workerd` (open upstream issue). Covered by C3.
- One shared 100k pool across web and room: a bot spike can stop live-table reconnects for the rest of
  the UTC day. WAF and Bot Fight Mode mitigate it; Workers Paid removes it.
- Duplicate Convex reads. SSR loaders run their queries through `ConvexHttpClient`, then the browser
  subscribes to the same queries. Whether Convex's query cache absorbs the second read's database I/O
  was not verified. Q16 makes Convex I/O the binding constraint, so this matters as much as Worker CPU,
  and option A removes it.
- `NODE_ENV` unset in the Worker silently loosens CSP. Covered by C1.
- The Wrangler bump (4.123 → ≥ 4.143) also changes the session Worker's tooling; run its tests in the
  same slice.

## Not verified

- Real `workerd` CPU for any page, and all signed-in page CPU. The local numbers are Node, anonymous
  and noisy. Miniflare does not enforce CPU limits, so only a deployed Worker can settle C2.
- Whether `CF-Connecting-IP` is overwritten when a client sends it (the docs do not say explicitly).
- Whether a Worker invocation that reaches a Durable Object counts once or twice against the Free
  pools.
- ~~`node:module` `createRequire` behavior in the bundled Worker~~ (resolved below: none remains).
- ~~Multiple `Set-Cookie` preservation through the proxy in `workerd`~~ (proven below).
- The current production web hostname and its DNS records. The repo names only
  `tabletop[-staging].artificertoolkit.app` for the session Worker.
- The Convex query-cache question above.

[cf-tss]: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
[cf-tss-log]: https://developers.cloudflare.com/changelog/post/2025-10-24-tanstack-start/
[tss-hosting]: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
[npm-plugin]: https://registry.npmjs.org/@cloudflare/vite-plugin/latest
[cf-vite-assets]: https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/
[cf-assets-routing]: https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
[cf-spa]: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
[cf-assets-billing]: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
[cf-headers]: https://developers.cloudflare.com/workers/static-assets/headers/
[cf-headers-ref]: https://developers.cloudflare.com/fundamentals/reference/http-headers/
[cf-node]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
[cf-env]: https://developers.cloudflare.com/workers/configuration/environment-variables/
[cf-limits]: https://developers.cloudflare.com/workers/platform/limits/
[cf-pricing]: https://developers.cloudflare.com/workers/platform/pricing/
[cf-pages-pricing]: https://developers.cloudflare.com/pages/functions/pricing/
[cf-do-pricing]: https://developers.cloudflare.com/durable-objects/platform/pricing/
[cf-rollbacks]: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
[cf-custom-domains]: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
[cf-previews]: https://developers.cloudflare.com/workers/previews/compare-workflows/
[cf-cpu-log]: https://developers.cloudflare.com/changelog/post/2025-04-09-workers-timing/
[sentry-cf-tss]: https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/tanstack-start/
[sentry-20038]: https://github.com/getsentry/sentry-javascript/issues/20038
