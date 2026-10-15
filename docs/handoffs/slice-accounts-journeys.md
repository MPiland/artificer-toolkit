# Slice workbook: ACCOUNTS-1, ACCOUNTS-5, ACCOUNTS-8 and RELEASE-6 (account journeys and the live Campaign refusal)

**Status:** DONE, merged 72193db49 (2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

The acceptance criteria of ACCOUNTS-1, ACCOUNTS-5 and ACCOUNTS-8 are already DONE. What keeps each PBI open is its ledger `journeyGap`: no end-to-end journey proves the user-visible flow. RELEASE-6 needs one observed live run. All four use the browser and local-backend harnesses, so they run in one session, against the local Docker Convex backend only (never a cloud deployment, ADR 0035).

| PBI | Journey gap to close (ledger `journeyGap`) |
|---|---|
| ACCOUNTS-1 (sign in on web and native) | Browser SSR sign-in, hydration and reload keep the session. An HTTP-level native bearer call (the native client's token on a Convex HTTP route or function call) succeeds, and a missing or forged bearer is refused. |
| ACCOUNTS-5 (log in) | A successful email login and a successful username login each return to the requested path (deep link → sign in → back to that path). |
| ACCOUNTS-8 (control who sees my profile) | Two accounts. For each profile privacy setting, the second account sees exactly what the setting allows: the profile page or read, and Social eligibility. |
| RELEASE-6.1 | A live-backend run of `apps/web/tests/live-backend/campaignMembership.ts` and `sceneLiveDiagnostics.ts` observes the deployed console shape of the typed `CAMPAIGN_NOT_FOUND` rejection, and the regexes match it. If they do not match, fix the regexes to the observed shape and record the observed text. |

Use the existing harnesses. Do not build new ones:

- `apps/web/tests/e2e/app` (Playwright `--project=app`; `authConfirmation.spec.ts` is the auth starting point);
- `apps/web/tests/live-backend` (`authenticatedSession.ts`, `social.ts`, `passwordRecovery.ts`). These are driven by `scripts/validatePreStagingLocal.mjs`; read how it starts the web server, seeds accounts and reads the local application env without an admin key.

Put browser journeys where the criterion is about what the user sees (SSR, reload, redirect, the other account's view). Use the HTTP or live-backend layer for the native bearer call. Accounts are created through the app's own sign-up or the harness's existing test-account path, with generated test values. Never use real credentials, and never print tokens, JWTs or keys.

Product behavior is already specified, so a journey that fails is a possible bug. Do not weaken the journey. Report the failure, with the evidence, to the main session.

Read first:

- PRODUCT.md (accounts and profile privacy);
- the ACCOUNTS-1, ACCOUNTS-5, ACCOUNTS-8 and RELEASE-6 entries in `docs/roadmap/08-phase-ledger.json`;
- `apps/apis/convex/auth.test.ts`, `authJwks.test.ts` and `social/profiles.test.ts` (the proofs below the journeys);
- `apps/web/tests/e2e/app/authConfirmation.spec.ts`;
- the live-backend files named above;
- `scripts/validatePreStagingLocal.mjs` (how it runs the live-backend suite);
- AGENTS.md "Secrets" and "Windows Process Execution".

## Closes

- The journey gaps of ACCOUNTS-1, ACCOUNTS-5 and ACCOUNTS-8. Their PBIs go DONE with `journeyStatus: verified`.
- AC RELEASE-6.1.

## File scope

`apps/web/tests/e2e/app`, `apps/web/tests/live-backend`, and the Playwright config only if a project entry is missing. Product code changes only to fix a bug a journey exposes. Report the bug first if the fix changes user-visible behavior or a contract.

## Runtime notes

- Check whether a web dev server or the local Convex backend is already running before starting anything. Start the web server once, record the PID, and stop only what you started.
- The local Convex backend at 127.0.0.1:3210 runs the main checkout's deployed code. Your tests run against that; you do not deploy. If a journey needs a backend change, report it.
- Hold the validation lock for every Playwright, live-backend or codegen run. One batch per hold.

## Red-first checklist

Journeys that pass on first run against already-working product code are acceptable; record that they pass on base. A journey that exposes a bug needs a failing regression run before the fix.

1. ACCOUNTS-1: browser SSR sign-in, hydration, reload. Native bearer accepted; a missing or forged bearer refused.
2. ACCOUNTS-5: email login and username login each return to the requested path.
3. ACCOUNTS-8: a two-account journey across each privacy setting.
4. RELEASE-6: the observed console text is recorded in the status log and the regexes match it.
5. Logs under `local-validation/accounts-journeys/`.

## Status log

- 2026-10-14: workbook written.
- 2026-10-14: journeys added to the existing `--auth-browser`/`--profile-browser` proof (`apps/apis/tests/developmentDrafts.ts` driving `apps/web/tests/live-backend/authenticatedSession.ts`), run by `scripts/runLocalConvexProof.ps1` against the local Docker backend:
  - ACCOUNTS-1: SSR sign-in, reload keeps the session (the reload response server-renders the signed-in shell, then hydrates on `/systems` with no sign-in bounce), a live native bearer resolves `api.account.identity` to the author, a forged bearer is refused (`InvalidAuthHeader`: "Could not decode token... does this key match any key in the provider's JWKS?"), and the unauthenticated client gets `Unauthenticated`.
  - ACCOUNTS-5: a protected deep link (`/systems`) redirects to `/sign-in?redirect=/systems`; an email login and a username login each return to `/systems`.
  - ACCOUNTS-8: two accounts, under Private and Public: the second account's browser view (page or "private or doesn't exist"), its native `publicProfile` read, the author's own `profile.visibility`, and Social eligibility equal to the pre-change baseline.
- 2026-10-14: **Bug, auth proxy 400 on every browser sign-in (found by these journeys; data, not code).** The local deployment's env values had been set from a CRLF file and carried a trailing CR. The Convex function's HMAC key (`AUTH_PROXY_SECRET`) therefore differed by one byte from the web app's, so the `server-client-ip` plugin rejected every proxied request with 400. PowerShell splits native output on CR/LF, so equality and length checks hid it; only a raw byte read (`yarn convex env get` through node `spawnSync`) shows it. The OIDC discovery document also carried a literal `\r`. Rejections are now logged (`authFactory.helper.ts`: jose error name and message, never the token) and covered by `authProxyRejection.test.ts`. The main session re-set the affected vars (`AUTH_PROXY_SECRET`, `SITE_URL`, and nine others: `MEDIA_STORAGE_MODE`, `MAIL_DELIVERY_MODE`, `LIVE_SESSION_*`, `LOCAL_*`, `CONTENT_SNAPSHOT_TOKEN_SECRET`, `RULES_CONTINUATION_SECRET`). `BETTER_AUTH_SECRET` keeps its CR on purpose (a consistent value everywhere; changing it rotates the encrypted JWKS).
- 2026-10-14: **Journey corrections (mine, not product bugs).** (1) D75 renders page bodies client-side, so the SSR signal after reload is the signed-in shell (`aria-label="Open account menu"`, which `Shell` passes as the `accountControl`; `Header` ignores `accountLabel` when one is given), not page content. (2) Better Auth allows 3 requests per 10 s on each sign-in path and answers the next with a 429. The journey signs in more often than that, so `signIn` waits out the window instead of depending on machine speed. (3) The live-backend `CAMPAIGN_NOT_FOUND` check used `instanceof ConvexError` from the web test directory; the workspace holds two `convex` copies (root and `apps/apis`, both 1.46.0), so the apis-side client throws a different class. It now uses `assertDomainRejection` from `apps/apis/tests/developmentClient.ts`.
- 2026-10-14: **RELEASE-6.1 observed text** (campaign-membership browser run, player console, query `campaigns/queries:get`):
  `ConvexError: [CONVEX Q(campaigns/queries:get)] [Request ID: <hex>] Server Error` then `Uncaught ConvexError: {"code":"DOMAIN_REJECTED","reason":"CAMPAIGN_NOT_FOUND","message":"Campaign not found."}`, then `  Called by client` and `    at ...` stack lines. The regexes expected an optional `Error: ` prefix only; the console prefix is `ConvexError: `. `queryDenial` (campaignMembership.ts) and `consoleDeparture` (sceneLiveDiagnostics.ts) now accept `(?:(?:Convex)?Error: )?`; the rest of both patterns matched the observed text unchanged. The React-boundary variants (`denialBoundary`, `liveDenialBoundary`) did not occur in the observed runs and are unchanged.
- 2026-10-14: Stale `packages/*/dist` after the base merge produced 26 `typecheck:convex` errors and a Worker zod `valueKind` failure (close 1008 in scene-live). Rebuilding shared, schema, source-data, authoring, rules-runtime and encounter-persistence in that order cleared both. Not a branch defect.
- Logs: `local-validation/accounts-journeys/` (`run5-*`, `run6-*` and `run7-*`: fixtures, web build, probe, per-proof logs and exit files, session worker and web app logs).

## Proposed ledger edits (filled by the slice session)

Do not apply until the main session reviews the merge.

- ACCOUNTS-1: `journeyStatus: "verified"`, drop `journeyGap`, `status: "DONE"`; `journeyTests`: add `apps/web/tests/live-backend/authenticatedSession.ts` and `apps/apis/tests/developmentDrafts.ts` (`scripts/runLocalConvexProof.ps1 -Proof profile-browser`; the `auth-browser` proof shares the same verification code but was not run in this slice); add `apps/apis/convex/authProxyRejection.test.ts`.
- ACCOUNTS-5: `journeyStatus: "verified"`, drop `journeyGap`, `status: "DONE"`; `journeyTests`: add `apps/web/tests/live-backend/authenticatedSession.ts` and `apps/apis/tests/developmentDrafts.ts` (`--profile-browser`, `-Proof profile-browser`).
- ACCOUNTS-8: `journeyStatus: "verified"`, drop `journeyGap`, `status: "DONE"`; `journeyTests`: add `apps/web/tests/live-backend/authenticatedSession.ts` and `apps/apis/tests/developmentDrafts.ts` (`--profile-browser`, `-Proof profile-browser`).
- RELEASE-6: AC RELEASE-6.1 `status: "DONE"`, proof `apps/web/tests/live-backend/campaignMembership.ts` and `sceneLiveDiagnostics.ts` (`-Proof campaign-membership-browser`, `-Proof scene-live-browser`, logs `local-validation/accounts-journeys/run7-*`, observed text in the status log above); PBI `status: "DONE"`, `journeyTests` both files, `journeyStatus: "verified"`.
