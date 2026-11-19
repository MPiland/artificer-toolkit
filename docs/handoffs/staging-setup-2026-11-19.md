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

## Open

1. **Blocker:** the web app answers 500 with `AUTH_PROXY_SECRET must be configured securely.` The value
   is shorter than the 64 characters `apps/apis/convex/lib/authProxyContext.ts` requires. The owner
   generates a 64-byte value, sets it in Convex and with
   `yarn workspace @artificer-toolkit/web exec wrangler secret put AUTH_PROXY_SECRET --env staging`.
   No redeploy is needed.
2. Pin `JWKS` to the deployment's signing keys (runbook: managed deployments pin them).
3. Decide `PUBLIC_SIGN_UP_ENABLED` and `LIBRARY_IMPORT_ENABLED` for staging.
4. Session Worker admission preflight, Resend delivery, the managed smoke (`scripts/managedSmoke.mjs`)
   with the SSR CPU export, V15, and gates C3 (Sentry) and C4 (forged `CF-Connecting-IP`).
5. Revoke the 30-day Convex deploy key once staging is done.
