# RELEASE-3.T1: staging promotion packet

> **Status:** prepared 2026-11-07, local only. Nothing was deployed, read from or written to Convex Cloud, Cloudflare, R2 or Resend.
>
> **Scope:** the exact target list, rollback capture, Worker staging package evidence and the managed smoke plus cold-isolate SSR CPU measurement that RELEASE-3.T2 runs. Feeds AC RELEASE-3.1. RELEASE-3.T4 found staging empty, so the first promotion is a fresh deploy behind a pre-flight check (below).
>
> **Update when:** a target name, the build, the smoke script or a threshold changes before T2 runs.
>
> **Verification:** `local-validation/release-3-t1/` (ignored; logs named below), `scripts/managedSmokePolicy.test.mjs`, CI on `ci/release-3-t1`.

The user's authorization for T2 must name every target below with its placeholders filled. An agent never fetches a placeholder (ADR 0035); the operator runs the read-only command beside it.

## Source identity

| Item                         | Value                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release-candidate tip (D213) | `ccc73867ecaeb3a33e9ad1cac718616de2629351`                                                                                                                                                               |
| D213 runs on that tip        | Tests (`full=true`) 42423488514, Live backend 42423478779, Browser journeys (no proof named) 42423490943: all success. The push-triggered Browser journeys run 42423478533 was superseded and cancelled. |
| Packet built on              | `7bd36e6f17e35d27c204039686e69430df2de87d` (phase tip when T1 started; the phase tip may have advanced). T2 deploys the commit the user names, which must contain the RC tip.                            |
| Final local manifest         | D213 replaced the local lifecycle as the gate, so the manifest is the three runs above. `yarn validate:pre-staging:local` was not required.                                                              |

## Target list

Names marked **committed** come from the repository. Names marked **PLACEHOLDER** exist only in the cloud accounts and are filled by the operator.

| Service                  | Target                                                                                                                                                                                                                                                                                                                                                                                           | Source                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Convex (staging)         | `https://<CONVEX_SLUG>.convex.cloud` and `https://<CONVEX_SLUG>.convex.site`. **PLACEHOLDER** `<CONVEX_SLUG>`; the same slug is `REVIEW_MANAGED_CONFIRM`.                                                                                                                                                                                                                                        | `apps/apis/README.md`, `scripts/managedSmokePolicy.mjs`       |
| Web Worker (staging)     | Worker `artificer-web-staging` (Wrangler env `staging`, `workers_dev` and preview URLs off). Hostname **PLACEHOLDER** `<STAGING_WEB_ORIGIN>`: `apps/web/wrangler.jsonc` has no staging route yet (runbook step 4 of [web Worker hosting](../runbooks/web-worker-hosting.md)). Deployed only by the manual `Deploy web Worker` workflow, `environment=staging`, GitHub environment `web-staging`. | `apps/web/wrangler.jsonc`, `.github/workflows/deploy-web.yml` |
| Session Worker (staging) | Worker `artificer-live-session-staging`, custom domain `tabletop-staging.artificertoolkit.app`, Durable Object `LiveSessionRoom` (SQLite), binding `CONTENT_SNAPSHOTS`.                                                                                                                                                                                                                          | `apps/session-worker/wrangler.jsonc`                          |
| R2                       | `artificer-content-snapshots-staging` (Session Worker binding, committed). Product media bucket (`R2_BUCKET`) and the Convex content-snapshot bucket (`CONTENT_SNAPSHOT_R2_BUCKET`): **PLACEHOLDER** names; both private.                                                                                                                                                                        | `wrangler.jsonc`, `apps/apis/README.md`                       |
| Resend                   | Account and sending domain **PLACEHOLDER**; staging delivers real mail with `MAIL_DELIVERY_MODE=resend` and no `RESEND_TEST_RECIPIENT` (owner decision 2026-11-23: public sign-up is off, so mail reaches only invited or existing accounts).                                                                                                                                                    | `apps/apis/README.md`                                         |

### Variable and secret names to verify at T2 (names only; values stay with the operator)

- **Convex deployment:** `SITE_URL` (the staging web origin), `AUTH_PROXY_SECRET`, `MAIL_DELIVERY_MODE`, `AUTH_EMAIL_FROM`, `NOTIFICATION_EMAIL_FROM`, `RESEND_API_KEY`, `MEDIA_STORAGE_MODE` (`r2`), `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CONTENT_SNAPSHOT_R2_BUCKET`, `CONTENT_SNAPSHOT_TOKEN_SECRET`, `LIVE_SESSION_WORKER_URL`, `LIVE_SESSION_TICKET_SECRET`, `LIVE_SESSION_WORKER_SECRET`.
- **Web Worker secrets:** `AUTH_PROXY_SECRET` (must equal Convex's), `CONVEX_SITE_URL`. GitHub `web-staging` variables: `VITE_CONVEX_URL`, `VITE_LIVE_SESSION_WEBSOCKET_URL`, `VITE_MEDIA_STORAGE_ORIGIN` (the workflow refuses without them).
- **Session Worker:** `LIVE_SESSION_ALLOWED_ORIGINS` (the staging web origin), `CONVEX_SITE_URL`, `LIVE_SESSION_TICKET_SECRET`, `LIVE_SESSION_WORKER_SECRET`, `CONTENT_SNAPSHOT_TOKEN_SECRET`. `LOCAL_CONTENT_SNAPSHOT_ORIGIN` must be absent.
- **Operator shell for the smoke (T2):** `CONVEX_URL`, `CONVEX_SITE_URL`, `REVIEW_MANAGED_CONFIRM`, `REVIEW_MANAGED_ADMIN_KEY`, `REVIEW_MAILBOX`. `CONVEX_DEPLOY_KEY` and the self-hosted variables stay unset.

## Rollback capture (run by the operator before any deploy)

All are read-only. Paste each result into the T2 manifest.

**Pre-flight (first promotion only, right before the first deploy).** [RELEASE-3.T4](release-3-t4-upgrade-readiness-2026-11-07.md) found that staging holds no source and no data, so the first promotion is a fresh deploy with nothing to migrate. Confirm that this is still true: in the Convex dashboard for `<CONVEX_SLUG>`, the Functions page lists no deployed functions and the Data page lists no tables (system tables aside). If either is not empty, stop. T4's narrowing diff and local rehearsal must run against the deployed commit first.

| Capture                          | Command (operator)                                                                                                                                                                                                                                                                                                         | Result |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Convex staging deployed source   | Before the first promotion: "none", confirmed by the pre-flight above. **After the deploy**, record the commit T2 deployed here. Every later promotion diffs the stored schema from that commit and migrates any narrowing change ([T4, later promotions](release-3-t4-upgrade-readiness-2026-11-07.md#later-promotions)). |        |
| Web Worker active version        | `npx wrangler deployments list --name artificer-web-staging` and `npx wrangler versions list --name artificer-web-staging`                                                                                                                                                                                                 |        |
| Session Worker active version    | `yarn workspace @artificer-toolkit/session-worker exec wrangler deployments list --env staging` (and `versions list`)                                                                                                                                                                                                      |        |
| Web Worker secrets present       | `npx wrangler secret list --name artificer-web-staging` (names only)                                                                                                                                                                                                                                                       |        |
| Session Worker secrets present   | `yarn workspace @artificer-toolkit/session-worker exec wrangler secret list --env staging` (names only)                                                                                                                                                                                                                    |        |
| R2 buckets exist and are private | Cloudflare dashboard, or `npx wrangler r2 bucket list`; confirm no public access and the CORS rule on the media bucket                                                                                                                                                                                                     |        |
| Resend sending domain verified   | Resend dashboard                                                                                                                                                                                                                                                                                                           |        |

Restore is `wrangler rollback <version-id>` per Worker and the Convex dashboard's deployment history, as the [runbook](../runbooks/phase-8-2-release.md#rollback) says. Capture the ids before the first deploy so a failed smoke can roll all three back.

## Worker staging package (local evidence)

`yarn workspace @artificer-toolkit/session-worker check:deployed-config` and `build:staging` (a Wrangler `--dry-run`, which contacts no service) ran through the validation lock on the packet's source. `build:staging` needed the workspace packages' `dist`, which a fresh checkout lacks, so the batch built them first (`turbo run build --filter=@artificer-toolkit/session-worker^...`).

| Step                    | Exit | Log                                                       |
| ----------------------- | ---- | --------------------------------------------------------- |
| `check:deployed-config` | 0    | `local-validation/release-3-t1/check-deployed-config.log` |
| dependency builds       | 0    | `local-validation/release-3-t1/build-dependencies.log`    |
| `build:staging`         | 0    | `local-validation/release-3-t1/build-staging.log`         |

The package is 8597.78 KiB (1603.79 KiB gzip) and binds `LIVE_SESSION_ROOMS` (Durable Object) and `CONTENT_SNAPSHOTS` (`artificer-content-snapshots-staging`). `dist-staging/index.js` was 8,804,122 bytes, SHA-256 `ee10a9e6127e33108fa7e3629bd247c4a79e0219f3ee05fe1a732f4ff6b930e7` (`local-validation/release-3-t1/dist-staging.sha256`); the output is not committed. A deploy builds again, so compare its bundle hash with this one only on the same commit and toolchain. The web Worker builds in the `Deploy web Worker` workflow, which this packet does not run.

## Managed smoke and cold-isolate SSR CPU measurement

`scripts/managedSmoke.mjs` (policy in `scripts/managedSmokePolicy.mjs`, tested by `scripts/managedSmokePolicy.test.mjs`; driver `apps/apis/tests/developmentManagedSmokeCli.ts`).

**Why two phases.** Worker CPU time is not visible to a client. The script drives the requests and records each response's `cf-ray`; the operator exports the matching Workers Logs rows; `evaluate` joins them offline. Workers Logs is on (`observability.enabled` in `apps/web/wrangler.jsonc`).

**`run`** (the only command that touches staging; bounded to one account and at most three rounds of the six or seven signed-in pages):

```text
node scripts/managedSmoke.mjs run --web-origin=https://<STAGING_WEB_ORIGIN> [--rounds=N] [--idle-minutes=M] [--system-id=<id>] [--out=local-validation/release-3/<name>/requests.json]
```

- **Refuses** to start without an explicit HTTPS `--web-origin` (not loopback, not a Convex host), the managed environment above, a `REVIEW_MANAGED_CONFIRM` equal to the `*.convex.cloud` slug, no deploy key or self-hosted variable, `--rounds` from 1 to 3 and `--idle-minutes` from 5 to 30. It has no default target.
- **Fixtures.** One account `<mailbox>+smoke-<runId>@<domain>`, created by the product's invitation redemption (the review-data path), signed in through the web Worker, and removed by the product's `POST /api/auth/account/delete` with the account's own password and session. The script then polls for the user's absence. The password is generated in memory and never printed or stored. The script never resets, reseeds or patches staging (AC RELEASE-3.3), and the account owns no other rows, so the deletion covers the fixture.
- **Pages.** The seven the R05.2 request audit walks (`signedInPaths` in `apps/web/tests/live-backend/signedInRequestAudit.ts`, imported, not copied); the systems detail page needs `--system-id`. Each must answer 200 with `no-store`.
- **Cold isolates.** Cloudflare cannot force one. Round 0 is cold only if the operator starts it immediately after the web Worker deploy; every later round waits `--idle-minutes` so the previous isolate is evicted. The first request of each round is marked `cold`; the rest of the round is warm. The evaluator refuses a run with no cold request.
- **Exit.** Non-zero if the run fails or the fixture is not verified deleted. `requests.json` records `fixtureEmail` and `cleanup`; on `unverified`, remove the fixture with `accountDeletion:schedule` before finishing.

**Operator export.** In the Cloudflare dashboard (Workers → `artificer-web-staging` → Logs → Query Builder), filter on the run's time window and export, for each invocation, the request header `cf-ray`, `$workers.cpuTimeMs` and `$workers.outcome` as `cpu-rows.json`:

```json
[{ "cfRay": "<cf-ray>", "cpuTimeMs": 3.2, "outcome": "ok" }]
```

**`evaluate`** (offline, no network):

```text
node scripts/managedSmoke.mjs evaluate --requests=local-validation/release-3/<name>/requests.json --cpu=local-validation/release-3/<name>/cpu-rows.json --out=local-validation/release-3/<name>/verdict.json
```

**Thresholds.**

| Rule                                                                          | Source                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every invocation `outcome` is `ok` (no `exceededCpu`), cold requests included | Gate C2 as D233 defines it, [web Worker hosting](../runbooks/web-worker-hosting.md#gates-before-production-d65). CPU p75, max and cold max are recorded, not held to 10 ms, because production runs on Workers Paid. |
| Every request has exactly one CPU row                                         | A missing row is inconclusive and fails                                                                                                                                                                              |
| At least one cold request; fixture `cleanup` is `deleted`                     | D75 (cold isolates); RELEASE-3.1                                                                                                                                                                                     |

A wall-clock figure (`wallMs` in `requests.json`) is recorded for evidence only. D210 keeps latency out of correctness gates; the CPU outcome rule above is the staging gate.

**Not covered by the script (done by hand at T2, from the runbook):** Worker admission and `GET /health` of the session Worker (`MANAGED_VTT_BASE_URL=<web origin> MANAGED_LIVE_SESSION_ENDPOINT=https://tabletop-staging.artificertoolkit.app yarn workspace @artificer-toolkit/session-worker preflight:managed`), Resend delivery, R2 CORS, the managed V15 workload, C3 (Sentry) and C4 (forged `CF-Connecting-IP`).

**Staging results (2026-11-23):**

- **C3 PASS.** With `VITE_SENTRY_DSN` set on `web-staging` (deploy run 45259442724), `GET /_serverFn/c3-probe` answered 500 ("Server function info not found for c3-probe", cf-ray `a5f2ede979b46b43`, 20:30:00 UTC) and the owner confirmed the event in Sentry.
- **C4 PASS.** A client-sent `CF-Connecting-IP` is refused at the edge (403, error 1000). Six sign-in attempts with forged `X-Artificer-Client-IP` and `X-Forwarded-For` (each a different address) answered 401 three times, then 429 three times (cf-rays `a5f2d101…` to `a5f2d126…`), so the rate limiter keyed on the real client IP.
- **C2 FAILED under the original 10 ms rule** (smoke run `mwtouizd`: p75 75 ms, max 111 ms, all outcomes ok). D233 redefined C2 by outcome (PERF-7).
- **C2 PASS (D233)** on source m893 (Convex and web redeployed after PERF-8). Smoke run `mwtxcve1`: six signed-in pages, all 200 `private, no-store`, every invocation `ok`, CPU p75 103 ms, max 146 ms, cold 103 ms; the fixture was deleted and the smoke confirmed it. Evidence: `local-validation/release-3/smoke-2026-11-23-r4/`. Earlier runs reported cleanup as unverified because the temporary admin key lacked data read access (`deployment:data:view`), which the existence check needs; the owner confirmed the `mwtouizd`, `mwtvk6zv` and `mwtx7l4g` accounts were gone, and revoked the temporary admin key after the run.
- **PERF-8 document wait** (wall time from the smoke host): cold `/home` 1,496 ms before, then 971 ms and 1,220 ms after; warm median 545 ms before, then 347 ms and 392 ms after.
- **UAT round 1 frozen build (2026-11-24):** source `560006bd50f8b7cee5de099853e9978950f79d59` (m896: m893 plus ACCOUNTS-12 invitation sign-in and test-only changes). D213 gate on this tip: Tests (full) 45329466232, Live backend 45329469302, Browser journeys 45329472489 (all eight shards), all green. Deployed by Deploy Convex 45333440509 and Deploy web 45333749803 (staging); the Session Worker is unchanged since `f66726cc` and was not redeployed. `/`, `/sign-in` and `/api/auth/get-session` answered 200 afterwards. Staging is frozen for the owner's UAT (D212, D235); fixes ship between rounds.

## Placeholders the operator fills at T2

1. `<CONVEX_SLUG>`, the empty-deployment pre-flight result, and after the deploy the Convex source commit T2 deployed (the base for the next promotion's upgrade-in-place diff).
2. `<STAGING_WEB_ORIGIN>` and the committed `routes` entry for `artificer-web-staging`, plus the `web-staging` GitHub environment values.
3. Prior active version ids of both Workers (rollback table above).
4. Product media and content-snapshot R2 bucket names; Resend account and sending domain.
5. All secret and variable values (names are listed; values never enter the repo, logs or chat).
6. The Workers Logs export and the sign-off that the cold round started right after the deploy.
