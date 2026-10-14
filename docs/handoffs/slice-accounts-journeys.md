# Slice workbook: ACCOUNTS-1, ACCOUNTS-5, ACCOUNTS-8 and RELEASE-6 (account journeys and the live Campaign refusal)

**Status:** OPEN (started 2026-10-14)
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

## Proposed ledger edits (filled by the slice session)
