# Slice workbook: PLATFORM-13.T8 (quiet scheduled jobs in Convex tests)

**Status:** DONE (2026-10-15), pending merge. CI proof: Tests run 38837544815 on `ci/platform-13-t8` (3cdb69780), green
**Base:** `codex/phase-08-2-convex-cutover`.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief (AC PLATFORM-13.10)

Every Convex shard log carries "Error when running scheduled function … must be configured" lines (for example runs 38792840212 and 38789989223). They fail nothing but bury the real failure.

- **Sources:**
  - `apps/apis/convex/media/storage.ts`
  - `apps/apis/convex/emailTransport.ts`
  - the live-session Worker URL read (`LIVE_SESSION_WORKER_URL`)
  - any other `must be configured` throw reached from a scheduled job
- **Fix:** Configure the convex-test environment with the test or disabled modes the product already supports (`MEDIA_STORAGE_MODE`, `MAIL_DELIVERY_MODE`, `LIVE_SESSION_WORKER_URL`), in the shared test setup rather than per test.
- **Don't:**
  - Silence logging, catch and drop errors, or add a test-only branch to product code.
  - If a job has no supported test mode, report it instead of inventing one.
- **Keep:** Tests that assert the "must be configured" throw (for example `media/storage.test.ts`) must still prove it, by clearing the variable locally.
- **Proof:** A CI run on `ci/<slice>` whose Convex shard logs contain no "must be configured" scheduled-function errors. Record the run id here.
- **Validation:**
  - Iterate in the light lane on a few affected test files.
  - The checkpoint is CI via `git push origin HEAD:ci/platform-13-t8`.

## Status log

- **2026-10-15, AC 13.10 proved.**
  - **Change:** test and config files only; no product code changed.
    - `apps/apis/vitest.config.ts`:
      - `env` selects the product's local modes: `MEDIA_STORAGE_MODE=local`, `CONVEX_SITE_URL`, `MAIL_DELIVERY_MODE=local`, `LOCAL_EMAIL_SINK_URL`, `LIVE_SESSION_WORKER_URL` and `LIVE_SESSION_WORKER_SECRET`.
      - `setupFiles` adds `apps/apis/tests/localServices.ts`.
    - `apps/apis/tests/localServices.ts` (new):
      - Starts the existing local R2 fixture (`startLocalR2`) per test file and assigns `LOCAL_R2_ENDPOINT` (assigned, not stubbed, so a test's `vi.unstubAllEnvs()` restores it).
      - Answers the default local email sink and Worker origins with a 204 through a `fetch` wrapper. The origins are captured at load, so fixtures that stub their own Worker URL are unaffected.
    - `campaigns/deletionCustody.test.ts`:
      - The scheduled snapshot build now succeeds against the fixture, so it uploads the owner Source's `contentSnapshotObjects`.
      - The table comparison now leaves out only `SOURCE`-scope objects, as it already left out `contentSnapshotHeads`.
      - Objects of every other scope must still match.
  - **Mode gap:** `LIVE_SESSION_WORKER_URL` has no disabled or test mode, and `MAIL_DELIVERY_MODE` has no disabled mode (only `local`, which fetches the sink). Both are answered by the `fetch` wrapper, which is a platform double, not a product mode.
  - **Proof:**
    - Run 38837544815: 0 `must be configured` lines and 0 `is required for live-room` lines in the shard logs.
    - Baseline: 45 and 20 (run 38792840212).
    - Earlier runs: 38833463155 failed (typecheck `origin` shadowing; the fetch wrapper keyed on the live env URL broke the room-worker fixtures). 38835172582 failed only on `deletionCustody`, which the table-comparison change above addresses.
  - **Throw-asserting tests still prove their throws:** `liveSessions/control.test.ts` clears the URL; `media/storage.test.ts` clears `R2_ACCESS_KEY_ID`. No test asserted the `MEDIA_STORAGE_MODE` or `MAIL_DELIVERY_MODE` missing-variable throw before or after.
  - **Remaining scheduled-function errors (outside AC 13.10):**
    - 10 × status 503 and 1 × 429 from `liveSessions/control:send`: deliberate fault injection in `control.test`.
    - 5 × `media/avatarActions:deleteObjectBytes` UnknownError: in the baseline.
    - 1 × `lib:makeBatch` "Component resend/rateLimiter is not registered" (`notifications/delivery.test.ts`): in the baseline. A real test-setup gap.
  - **Review triage:**
    - Fixed: the whole-table exclusion in `deletionCustody.test.ts` narrowed to `SOURCE` scope; a redundant guard and the 204 comment in `localServices.ts`.
    - Stands (nits):
      - Tests still stub values the global env now sets (`MEDIA_STORAGE_MODE`, `CONVEX_SITE_URL`): harmless, removable later.
      - Fixed ports 8025 and 8787 for the sink and Worker. 8787 is wrangler's default, but a request cannot slip past the wrapper because it matches by origin.
      - A job still in progress at file end could log ECONNREFUSED after the R2 fixture closes: low likelihood, not seen in CI.
      - Call-count assertions in `control.test.ts` and `deletionLifecycle.test.ts` now also see background jobs that reach the test's own `fetch` stub: no failure in CI.
  - **Proposed ledger edits:**
    - Close PLATFORM-13.T8 (AC 13.10) with run 38837544815.
    - Register a follow-up: register the `resend/rateLimiter` component in the shared convex-test wrapper (`lib:makeBatch`), and look into the `avatarActions:deleteObjectBytes` UnknownError.
