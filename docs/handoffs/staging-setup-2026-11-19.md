# Staging setup, first promotion (RELEASE-3.T2)

> **Status:** in progress, paused 2026-11-19. Living handoff; fold the final values into the
> [RELEASE-3.T1 promotion packet](../validation/release-3-t1-promotion-packet-2026-11-07.md) when T2 closes.
>
> **Update when:** a staging step below completes or a target changes.

Names and non-secret values only. Secret values live in the Convex dashboard, Wrangler secrets, GitHub
environment secrets and the owner's password manager, never here.

## Targets

| Service        | Target                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convex         | `beaming-pig-820` (`https://beaming-pig-820.convex.cloud`, `.convex.site`)                                                                                                      |
| Web Worker     | `artificer-web-staging`, custom domain `staging.artificertoolkit.app`                                                                                                           |
| Session Worker | `artificer-live-session-staging`, custom domain `tabletop-staging.artificertoolkit.app`                                                                                         |
| R2             | media `artificer-toolkit-vtt-staging` (CORS: `https://staging.artificertoolkit.app` only); snapshots `artificer-content-snapshots-staging` (Convex and Worker)                  |
| GitHub         | environment `web-staging`: secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; variables `VITE_CONVEX_URL`, `VITE_LIVE_SESSION_WEBSOCKET_URL`, `VITE_MEDIA_STORAGE_ORIGIN` |

## Done

1. Pre-flight: Convex staging had no functions and no tables.
2. Convex deployed from `a4601721b99ddafa06ca6b1da006fde6b126c80e` (the D213 RC plus the m890 Worker
   names), with `--typecheck disable --codegen disable` as the repo runners do. This commit is the base for
   the next promotion's upgrade-in-place diff. `JWKS` is set to the empty value (database-backed signing
   keys) because `auth.config.ts` requires the variable before any push.
3. SRD seeded from the dashboard (`content/seed:seed`: 1,134 inserted, 1,058 subjects, 73 definitions,
   1 System); `content/seed:audit` passed with manifest checksum `87f80b40…7497f`.
4. Session Worker: prior version `327f054d-b26f-4452-bcb7-70e7eb05294f` (an old 2026-09 upload plus
   today's secret changes); deployed `1e17c59a-1a3a-4270-8613-e2e6691a9968` with `deploy:staging`;
   `GET /health` answered `200 {"ok":true}`. The retired `LIVE_SESSION_EXECUTOR_SECRET` was deleted.
5. Web Worker: `deploy-web.yml` added to `main` (`71eb707de`) so GitHub lists it; deployed by run
   44579685302 from `codex/phase-08-2-convex-cutover`.

6. `AUTH_PROXY_SECRET` replaced with a value of at least 64 characters (the minimum in
   `apps/apis/convex/lib/authProxyContext.ts`; the first value was 44) in Convex and on the web Worker.
   The dashboard saved the Worker secret as an undeployed version, so it was deployed with
   `wrangler versions deploy 864506a3-0e72-4ddb-9abb-6bcada2bd8d5@100% --name artificer-web-staging`.
   `/`, `/sign-in` and `/api/auth/get-session` (through the proxy to Convex) then answered 200.

## Open

1. `JWKS` stays empty (D232: default remote JWKS, no pinned keys). RELEASE-3.T5 removes the variable and fixes
   the rate-limit setup before the checks below.
2. Decide `PUBLIC_SIGN_UP_ENABLED` and `LIBRARY_IMPORT_ENABLED` for staging.
3. Session Worker admission preflight, Resend delivery, the managed smoke (`scripts/managedSmoke.mjs`)
   with the SSR CPU export, V15, and gates C3 (Sentry) and C4 (forged `CF-Connecting-IP`).
4. Revoke the 30-day Convex deploy key once staging is done.
